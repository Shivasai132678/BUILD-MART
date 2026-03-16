import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { NotificationType, RFQStatus, VendorStatus } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { generateQuoteReferenceCode } from '../common/utils/reference-code';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CounterOfferQuoteDto } from './dto/counter-offer-quote.dto';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { UpdateQuoteDto } from './dto/update-quote.dto';

type QuoteWithItems = Prisma.QuoteGetPayload<{
  include: { items: true };
}>;

type QuoteWithItemsAndVendor = Prisma.QuoteGetPayload<{
  include: { items: true; vendor: { select: { businessName: true } } };
}>;

@Injectable()
export class QuotesService {
  private readonly logger = new Logger(QuotesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async createQuote(vendorUserId: string, dto: CreateQuoteDto): Promise<QuoteWithItems> {
    const vendorProfile = await this.getVendorProfileByUserId(vendorUserId);

    if (vendorProfile.status !== VendorStatus.APPROVED) {
      throw new ForbiddenException('Vendor must be approved before submitting quotes');
    }

    const rfq = await this.prisma.rFQ.findUnique({
      where: { id: dto.rfqId },
      select: {
        id: true,
        buyerId: true,
        status: true,
      },
    });

    if (!rfq) {
      throw new NotFoundException('RFQ not found');
    }

    if (rfq.status !== RFQStatus.OPEN && rfq.status !== RFQStatus.QUOTED) {
      throw new BadRequestException('Quotes can only be submitted for OPEN or QUOTED RFQs');
    }

    const existingQuote = await this.prisma.quote.findUnique({
      where: {
        rfqId_vendorId: {
          rfqId: dto.rfqId,
          vendorId: vendorProfile.id,
        },
      },
      select: { id: true },
    });

    if (existingQuote) {
      throw new ConflictException('Vendor has already submitted a quote for this RFQ');
    }

    try {
      const createdQuote = await this.prisma.$transaction(async (tx) => {
        const referenceCode = await generateQuoteReferenceCode(tx);

        const quote = await tx.quote.create({
          data: {
            ...this.buildCreateQuoteData(dto, vendorProfile.id),
            referenceCode,
          },
        });

        await tx.quoteItem.createMany({
          data: dto.items.map((item) => ({
            quoteId: quote.id,
            productName: item.productName,
            quantity: item.quantity,
            unit: item.unit,
            unitPrice: item.unitPrice,
            subtotal: item.subtotal,
          })),
        });

        await tx.rFQ.updateMany({
          where: {
            id: dto.rfqId,
            status: RFQStatus.OPEN,
          },
          data: {
            status: RFQStatus.QUOTED,
          },
        });

        const quoteWithItems = await tx.quote.findUnique({
          where: { id: quote.id },
          include: { items: true },
        });

        if (!quoteWithItems) {
          throw new NotFoundException('Quote not found after creation');
        }

        return quoteWithItems;
      });

      this.logger.log(`Quote created id=${createdQuote.id} rfqId=${dto.rfqId}`);

      await this.notificationsService.create({
        userId: rfq.buyerId,
        type: NotificationType.QUOTE_RECEIVED,
        title: 'New quote received',
        message: `A vendor submitted a quote for RFQ ${dto.rfqId}.`,
        metadata: {
          rfqId: dto.rfqId,
          quoteId: createdQuote.id,
        },
      });

      return createdQuote;
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const targets = (error.meta?.target as string[] | string) ?? [];
        const targetStr = Array.isArray(targets) ? targets.join(',') : targets;

        if (targetStr.includes('referenceCode')) {
          throw new ConflictException('Reference code collision, please retry');
        }

        throw new ConflictException('Vendor has already submitted a quote for this RFQ');
      }

      throw error;
    }
  }

  async getQuotesForRFQ(
    rfqId: string,
    buyerId: string,
    limit: number = 20,
    offset: number = 0,
  ): Promise<{ data: QuoteWithItemsAndVendor[]; total: number; limit: number; offset: number }> {
    const rfq = await this.prisma.rFQ.findUnique({
      where: { id: rfqId },
      select: {
        id: true,
        buyerId: true,
      },
    });

    if (!rfq) {
      throw new NotFoundException('RFQ not found');
    }

    if (rfq.buyerId !== buyerId) {
      throw new ForbiddenException('You are not allowed to view quotes for this RFQ');
    }

    const where = { rfqId };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.quote.findMany({
        where,
        include: {
          items: true,
          vendor: {
            select: {
              businessName: true,
            },
          },
        },
        orderBy: {
          totalAmount: 'asc',
        },
        take: limit,
        skip: offset,
      }),
      this.prisma.quote.count({ where }),
    ]);

    return { data, total, limit, offset };
  }

  async updateQuote(
    quoteId: string,
    vendorUserId: string,
    dto: UpdateQuoteDto,
  ): Promise<QuoteWithItems> {
    const vendorProfile = await this.getVendorProfileByUserId(vendorUserId);
    const existingQuote = await this.prisma.quote.findUnique({
      where: { id: quoteId },
      include: {
        items: true,
        rfq: { select: { buyerId: true } },
      },
    });

    if (!existingQuote) {
      throw new NotFoundException('Quote not found');
    }

    if (existingQuote.vendorId !== vendorProfile.id) {
      throw new ForbiddenException('You are not allowed to modify this quote');
    }

    this.ensureQuoteIsEditable(existingQuote.validUntil);
    await this.ensureNoOrderExistsForQuote(quoteId);

    const updatedQuote = await this.prisma.$transaction(async (tx) => {
      await tx.quote.update({
        where: { id: quoteId },
        data: this.buildUpdateQuoteData(dto),
      });

      if (dto.items !== undefined) {
        await tx.quoteItem.deleteMany({
          where: { quoteId },
        });

        if (dto.items.length > 0) {
          await tx.quoteItem.createMany({
            data: dto.items.map((item) => ({
              quoteId,
              productName: item.productName,
              quantity: item.quantity,
              unit: item.unit,
              unitPrice: item.unitPrice,
              subtotal: item.subtotal,
            })),
          });
        }
      }

      const quote = await tx.quote.findUnique({
        where: { id: quoteId },
        include: { items: true },
      });

      if (!quote) {
        throw new NotFoundException('Quote not found');
      }

      return quote;
    });

    this.logger.log(`Quote updated id=${quoteId}`);

    // Notify the buyer that their quote has been revised
    const buyerId = existingQuote.rfq?.buyerId;
    if (buyerId) {
      await this.notificationsService.create({
        userId: buyerId,
        type: NotificationType.QUOTE_RECEIVED,
        title: 'Quote updated',
        message: `A vendor has revised their quote for your RFQ.`,
        metadata: {
          rfqId: existingQuote.rfqId,
          quoteId,
        },
      });
    }

    return updatedQuote;
  }

  async getVendorQuoteForRfq(
    rfqId: string,
    vendorUserId: string,
  ): Promise<QuoteWithItems | null> {
    const vendorProfile = await this.getVendorProfileByUserId(vendorUserId);

    const quote = await this.prisma.quote.findUnique({
      where: {
        rfqId_vendorId: {
          rfqId,
          vendorId: vendorProfile.id,
        },
      },
      include: { items: true },
    });

    return quote;
  }

  async counterOfferQuote(
    buyerUserId: string,
    quoteId: string,
    dto: CounterOfferQuoteDto,
  ): Promise<{ id: string; counterOfferPrice: string; counterOfferNote: string | null; counterStatus: string }> {
    const quote = await this.prisma.quote.findUnique({
      where: { id: quoteId },
      include: {
        rfq: { select: { buyerId: true, status: true } },
        vendor: { select: { userId: true } },
      },
    });

    if (!quote) {
      throw new NotFoundException('Quote not found');
    }

    if (quote.rfq.buyerId !== buyerUserId) {
      throw new ForbiddenException('Only the RFQ buyer can submit a counter-offer');
    }

    if (quote.isWithdrawn) {
      throw new BadRequestException('Cannot counter-offer a withdrawn quote');
    }

    const rfqStatus = quote.rfq.status;
    if (rfqStatus !== RFQStatus.OPEN && rfqStatus !== RFQStatus.QUOTED) {
      throw new BadRequestException('Counter-offers can only be sent for OPEN or QUOTED RFQs');
    }

    if (quote.counterStatus === 'PENDING') {
      throw new BadRequestException('A counter-offer is already pending on this quote');
    }

    await this.ensureNoOrderExistsForQuote(quoteId);

    const updated = await this.prisma.quote.update({
      where: { id: quoteId },
      data: {
        counterOfferPrice: new Prisma.Decimal(dto.counterOfferPrice),
        counterOfferNote: dto.counterOfferNote ?? null,
        counterStatus: 'PENDING',
      },
      select: {
        id: true,
        counterOfferPrice: true,
        counterOfferNote: true,
        counterStatus: true,
      },
    });

    this.logger.log(`Counter-offer sent quoteId=${quoteId} price=${dto.counterOfferPrice}`);

    await this.notificationsService.create({
      userId: quote.vendor.userId,
      type: NotificationType.QUOTE_COUNTER_OFFER,
      title: 'Buyer sent a counter-offer',
      message: `The buyer has proposed a counter-offer of ₹${dto.counterOfferPrice} for your quote.`,
      metadata: { quoteId, rfqId: quote.rfqId, counterOfferPrice: dto.counterOfferPrice },
    });

    return {
      id: updated.id,
      counterOfferPrice: updated.counterOfferPrice!.toFixed(2),
      counterOfferNote: updated.counterOfferNote,
      counterStatus: updated.counterStatus!,
    };
  }

  async respondToCounterOffer(
    vendorUserId: string,
    quoteId: string,
    accept: boolean,
  ): Promise<{ id: string; counterStatus: string }> {
    const vendorProfile = await this.getVendorProfileByUserId(vendorUserId);

    const quote = await this.prisma.quote.findUnique({
      where: { id: quoteId },
      include: { rfq: { select: { buyerId: true } } },
    });

    if (!quote) {
      throw new NotFoundException('Quote not found');
    }

    if (quote.vendorId !== vendorProfile.id) {
      throw new ForbiddenException('You are not allowed to respond to this counter-offer');
    }

    if (quote.counterStatus !== 'PENDING') {
      throw new BadRequestException('No pending counter-offer to respond to');
    }

    await this.ensureNoOrderExistsForQuote(quoteId);

    const newStatus = accept ? 'ACCEPTED' : 'REJECTED';

    const updateData: Prisma.QuoteUncheckedUpdateInput = { counterStatus: newStatus };

    // When vendor accepts the counter-offer, update totalAmount to match counterOfferPrice
    if (accept && quote.counterOfferPrice !== null) {
      const counterPrice = new Prisma.Decimal(quote.counterOfferPrice);
      const diff = counterPrice.minus(new Prisma.Decimal(quote.totalAmount));
      updateData.totalAmount = counterPrice;
      // Adjust subtotal by the diff; keep tax and delivery unchanged
      updateData.subtotal = new Prisma.Decimal(quote.subtotal).plus(diff);
    }

    const updated = await this.prisma.quote.update({
      where: { id: quoteId },
      data: updateData,
      select: { id: true, counterStatus: true },
    });

    this.logger.log(`Counter-offer ${newStatus} quoteId=${quoteId} by vendorId=${vendorProfile.id}`);

    const notificationType = accept
      ? NotificationType.QUOTE_COUNTER_ACCEPTED
      : NotificationType.QUOTE_COUNTER_REJECTED;

    const notificationTitle = accept
      ? 'Counter-offer accepted'
      : 'Counter-offer rejected';

    const notificationMessage = accept
      ? 'The vendor has accepted your counter-offer. You can now place an order.'
      : 'The vendor has rejected your counter-offer.';

    await this.notificationsService.create({
      userId: quote.rfq.buyerId,
      type: notificationType,
      title: notificationTitle,
      message: notificationMessage,
      metadata: { quoteId, rfqId: quote.rfqId },
    });

    return { id: updated.id, counterStatus: updated.counterStatus! };
  }

  async deleteQuote(quoteId: string, vendorUserId: string): Promise<{ message: string }> {    const vendorProfile = await this.getVendorProfileByUserId(vendorUserId);
    const existingQuote = await this.prisma.quote.findUnique({
      where: { id: quoteId },
      select: {
        id: true,
        vendorId: true,
      },
    });

    if (!existingQuote) {
      throw new NotFoundException('Quote not found');
    }

    if (existingQuote.vendorId !== vendorProfile.id) {
      throw new ForbiddenException('You are not allowed to delete this quote');
    }

    await this.ensureNoOrderExistsForQuote(quoteId);

    await this.prisma.quote.delete({
      where: { id: quoteId },
    });

    this.logger.log(`Quote deleted id=${quoteId}`);

    return { message: 'Quote deleted' };
  }

  private async getVendorProfileByUserId(vendorUserId: string) {
    const vendorProfile = await this.prisma.vendorProfile.findUnique({
      where: { userId: vendorUserId },
      select: { id: true, status: true },
    });

    if (!vendorProfile) {
      throw new NotFoundException('Vendor profile not found');
    }

    return vendorProfile;
  }

  private ensureQuoteIsEditable(validUntil: Date): void {
    if (validUntil.getTime() < Date.now()) {
      throw new BadRequestException('Quote can no longer be modified after validUntil');
    }
  }

  private async ensureNoOrderExistsForQuote(quoteId: string): Promise<void> {
    const existingOrder = await this.prisma.order.findUnique({
      where: { quoteId },
      select: { id: true },
    });

    if (existingOrder) {
      throw new BadRequestException('Quote cannot be modified because an order exists');
    }
  }

  private buildCreateQuoteData(
    dto: CreateQuoteDto,
    vendorProfileId: string,
  ): Prisma.QuoteUncheckedCreateInput {
    const data: Prisma.QuoteUncheckedCreateInput = {
      rfqId: dto.rfqId,
      vendorId: vendorProfileId,
      subtotal: dto.subtotal,
      taxAmount: dto.taxAmount,
      deliveryFee: dto.deliveryFee,
      totalAmount: dto.totalAmount,
      validUntil: new Date(dto.validUntil),
    };

    if (dto.notes !== undefined) {
      data.notes = dto.notes;
    }

    return data;
  }

  private buildUpdateQuoteData(
    dto: UpdateQuoteDto,
  ): Prisma.QuoteUncheckedUpdateInput {
    const data: Prisma.QuoteUncheckedUpdateInput = {};

    if (dto.subtotal !== undefined) {
      data.subtotal = dto.subtotal;
    }
    if (dto.taxAmount !== undefined) {
      data.taxAmount = dto.taxAmount;
    }
    if (dto.deliveryFee !== undefined) {
      data.deliveryFee = dto.deliveryFee;
    }
    if (dto.totalAmount !== undefined) {
      data.totalAmount = dto.totalAmount;
    }
    if (dto.validUntil !== undefined) {
      data.validUntil = new Date(dto.validUntil);
    }
    if (dto.notes !== undefined) {
      data.notes = dto.notes;
    }

    return data;
  }
}
