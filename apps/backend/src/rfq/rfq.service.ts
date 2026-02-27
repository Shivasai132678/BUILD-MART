import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { NotificationType, RFQStatus, UserRole } from '@prisma/client';
import type { Prisma, RFQ } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRfqDto } from './dto/create-rfq.dto';

type PaginatedRfqResponse = {
  items: RFQ[];
  total: number;
  limit: number;
  offset: number;
};

@Injectable()
export class RfqService {
  private readonly logger = new Logger(RfqService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async createRFQ(userId: string, dto: CreateRfqDto): Promise<RFQ> {
    const createdRfq = await this.prisma.$transaction(async (tx) => {
      const address = await tx.address.findFirst({
        where: {
          id: dto.addressId,
          userId,
        },
        select: { id: true },
      });

      if (!address) {
        throw new BadRequestException('Address does not belong to the buyer');
      }

      const rfq = await tx.rFQ.create({
        data: {
          buyerId: userId,
          addressId: dto.addressId,
          city: dto.city,
          status: RFQStatus.OPEN,
          validUntil: new Date(dto.validUntil),
          ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        },
      });

      await tx.rFQItem.createMany({
        data: dto.items.map((item) => ({
          rfqId: rfq.id,
          productId: item.productId,
          quantity: item.quantity,
          unit: item.unit,
          ...(item.notes !== undefined ? { notes: item.notes } : {}),
        })),
      });

      return tx.rFQ.findUnique({
        where: { id: rfq.id },
        include: {
          items: true,
        },
      });
    });

    if (!createdRfq) {
      throw new NotFoundException('RFQ creation failed');
    }

    const matchedVendorIds = await this.findMatchingVendorIds(
      createdRfq.city,
      dto.items.map((item) => item.productId),
    );

    this.logger.log(
      `RFQ ${createdRfq.id} matched vendor ids: ${matchedVendorIds.length > 0 ? matchedVendorIds.join(', ') : 'none'}`,
    );

    if (matchedVendorIds.length > 0) {
      const matchedVendors = await this.prisma.vendorProfile.findMany({
        where: {
          id: {
            in: matchedVendorIds,
          },
        },
        select: {
          id: true,
          userId: true,
        },
      });

      const matchedUserIds = matchedVendors.map((vendor) => vendor.userId);

      for (const vendorUserId of matchedUserIds) {
        try {
          await this.notificationsService.create({
            userId: vendorUserId,
            type: NotificationType.RFQ_CREATED,
            title: 'New RFQ available',
            message: `A new RFQ matching your products is available in ${createdRfq.city}.`,
            metadata: { rfqId: createdRfq.id },
          });

          this.logger.log(
            `Vendor notification sent for RFQ id=${createdRfq.id} userId=${vendorUserId}`,
          );
        } catch (error: unknown) {
          const message =
            error instanceof Error ? error.message : 'Unknown notification error';
          this.logger.error(
            `Vendor notification failed for RFQ id=${createdRfq.id} userId=${vendorUserId}: ${message}`,
          );
        }
      }
    }

    return createdRfq;
  }

  async listRFQs(
    userId: string,
    limit: number,
    offset: number,
  ): Promise<PaginatedRfqResponse> {
    const where: Prisma.RFQWhereInput = {
      buyerId: userId,
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.rFQ.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          items: true,
        },
      }),
      this.prisma.rFQ.count({ where }),
    ]);

    return { items, total, limit, offset };
  }

  async getAvailableRFQs(
    vendorId: string,
    limit: number,
    offset: number,
  ): Promise<PaginatedRfqResponse> {
    const vendorProfile = await this.prisma.vendorProfile.findUnique({
      where: { userId: vendorId },
      select: {
        id: true,
        city: true,
        products: {
          select: {
            productId: true,
          },
        },
      },
    });

    if (!vendorProfile) {
      throw new NotFoundException('Vendor profile not found');
    }

    const productIds = Array.from(
      new Set(vendorProfile.products.map((product) => product.productId)),
    );

    if (productIds.length === 0) {
      return {
        items: [],
        total: 0,
        limit,
        offset,
      };
    }

    const where: Prisma.RFQWhereInput = {
      status: RFQStatus.OPEN,
      city: vendorProfile.city,
      items: {
        some: {
          productId: {
            in: productIds,
          },
        },
      },
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.rFQ.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          items: true,
        },
      }),
      this.prisma.rFQ.count({ where }),
    ]);

    return { items, total, limit, offset };
  }

  async getRFQ(id: string, userId: string, role: UserRole): Promise<RFQ> {
    let where: Prisma.RFQWhereInput;

    if (role === UserRole.BUYER) {
      where = {
        id,
        buyerId: userId,
      };
    } else if (role === UserRole.VENDOR) {
      where = {
        id,
        status: {
          in: [RFQStatus.OPEN, RFQStatus.QUOTED],
        },
      };
    } else {
      throw new ForbiddenException('RFQ access is not allowed for this role');
    }

    const rfq = await this.prisma.rFQ.findFirst({
      where,
      include: {
        items: true,
      },
    });

    if (!rfq) {
      throw new NotFoundException('RFQ not found');
    }

    return rfq;
  }

  async closeRFQ(id: string, userId: string): Promise<RFQ> {
    const rfq = await this.prisma.rFQ.findUnique({
      where: { id },
      select: {
        id: true,
        buyerId: true,
      },
    });

    if (!rfq) {
      throw new NotFoundException('RFQ not found');
    }

    if (rfq.buyerId !== userId) {
      throw new ForbiddenException('You are not allowed to close this RFQ');
    }

    const updatedRfq = await this.prisma.rFQ.update({
      where: { id },
      data: {
        status: RFQStatus.CLOSED,
        closedAt: new Date(),
      },
      include: {
        items: true,
      },
    });

    this.logger.log(`RFQ closed id=${id}`);

    return updatedRfq;
  }

  private async findMatchingVendorIds(
    city: string,
    productIds: string[],
  ): Promise<string[]> {
    const uniqueProductIds = Array.from(new Set(productIds));

    if (uniqueProductIds.length === 0) {
      return [];
    }

    const vendors = await this.prisma.vendorProfile.findMany({
      where: {
        city,
        isApproved: true,
        deletedAt: null,
        products: {
          some: {
            productId: {
              in: uniqueProductIds,
            },
          },
        },
      },
      select: {
        id: true,
      },
    });

    return vendors.map((vendor) => vendor.id);
  }
}
