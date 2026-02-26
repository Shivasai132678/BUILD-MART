import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { RFQStatus } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { UpdateQuoteDto } from './dto/update-quote.dto';

type QuoteWithItems = Prisma.QuoteGetPayload<{
  include: { items: true };
}>;

@Injectable()
export class QuotesService {
  private readonly logger = new Logger(QuotesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createQuote(vendorUserId: string, dto: CreateQuoteDto): Promise<QuoteWithItems> {
    const vendorProfile = await this.getVendorProfileByUserId(vendorUserId);
    const rfq = await this.prisma.rFQ.findUnique({
      where: { id: dto.rfqId },
      select: {
        id: true,
        status: true,
      },
    });

    if (!rfq) {
      throw new NotFoundException('RFQ not found');
    }

    if (rfq.status !== RFQStatus.OPEN) {
      throw new BadRequestException('Quotes can only be submitted for OPEN RFQs');
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
        const quote = await tx.quote.create({
          data: this.buildCreateQuoteData(dto, vendorProfile.id),
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

      return createdQuote;
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Vendor has already submitted a quote for this RFQ');
      }

      throw error;
    }
  }

  async getQuotesForRFQ(rfqId: string, buyerId: string): Promise<QuoteWithItems[]> {
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

    return this.prisma.quote.findMany({
      where: { rfqId },
      include: { items: true },
      orderBy: {
        totalAmount: 'asc',
      },
    });
  }

  async updateQuote(
    quoteId: string,
    vendorUserId: string,
    dto: UpdateQuoteDto,
  ): Promise<QuoteWithItems> {
    const vendorProfile = await this.getVendorProfileByUserId(vendorUserId);
    const existingQuote = await this.prisma.quote.findUnique({
      where: { id: quoteId },
      include: { items: true },
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

    return updatedQuote;
  }

  async deleteQuote(quoteId: string, vendorUserId: string): Promise<{ message: string }> {
    const vendorProfile = await this.getVendorProfileByUserId(vendorUserId);
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
      select: { id: true },
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
