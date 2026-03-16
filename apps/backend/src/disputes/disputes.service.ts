import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Dispute, DisputeStatus, NotificationType, Prisma } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';

type PaginatedDisputes = {
  items: Dispute[];
  total: number;
  limit: number;
  offset: number;
};

@Injectable()
export class DisputesService {
  private readonly logger = new Logger(DisputesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async createDispute(buyerId: string, dto: CreateDisputeDto): Promise<Dispute> {
    const order = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
      include: { vendor: { select: { userId: true, businessName: true } } },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.buyerId !== buyerId) {
      throw new ForbiddenException('You do not own this order');
    }

    // Only allow disputes on delivered orders
    if (order.status !== 'DELIVERED') {
      throw new BadRequestException(
        'Disputes can only be raised on delivered orders',
      );
    }

    // One dispute per order
    const existing = await this.prisma.dispute.findFirst({
      where: { orderId: dto.orderId },
    });
    if (existing) {
      throw new BadRequestException('A dispute already exists for this order');
    }

    const dispute = await this.prisma.dispute.create({
      data: {
        orderId: dto.orderId,
        buyerId,
        vendorId: order.vendorId,
        reason: dto.reason,
        description: dto.description,
      },
    });

    this.logger.log(`Dispute created — id: ${dispute.id}, orderId: ${dto.orderId}`);

    // Notify vendor
    await this.notificationsService.create({
      userId: order.vendor.userId,
      type: NotificationType.DISPUTE_OPENED,
      title: 'Dispute Raised',
      message: `A buyer has raised a dispute for order ${order.referenceCode ?? order.id}`,
      metadata: { disputeId: dispute.id, orderId: order.id },
    });

    return dispute;
  }

  async listBuyerDisputes(
    buyerId: string,
    limit: number,
    offset: number,
    status?: DisputeStatus,
  ): Promise<PaginatedDisputes> {
    const where: Prisma.DisputeWhereInput = {
      buyerId,
      ...(status ? { status } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.dispute.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          order: { select: { referenceCode: true, totalAmount: true } },
        },
      }),
      this.prisma.dispute.count({ where }),
    ]);

    return { items, total, limit, offset };
  }

  async listVendorDisputes(
    vendorId: string,
    limit: number,
    offset: number,
    status?: DisputeStatus,
  ): Promise<PaginatedDisputes> {
    const where: Prisma.DisputeWhereInput = {
      vendorId,
      ...(status ? { status } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.dispute.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          order: { select: { referenceCode: true, totalAmount: true } },
        },
      }),
      this.prisma.dispute.count({ where }),
    ]);

    return { items, total, limit, offset };
  }

  async getDispute(id: string, userId: string): Promise<Dispute> {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id },
      include: {
        order: { select: { referenceCode: true, totalAmount: true, status: true } },
      },
    });

    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    // Buyer or vendor involved can view it; admin handled separately
    if (dispute.buyerId !== userId) {
      // Check if vendor
      const vendorProfile = await this.prisma.vendorProfile.findUnique({
        where: { userId },
        select: { id: true },
      });
      if (!vendorProfile || dispute.vendorId !== vendorProfile.id) {
        throw new ForbiddenException('You cannot view this dispute');
      }
    }

    return dispute;
  }

  // ─── Admin methods ─────────────────────────────────────────

  async listAllDisputes(
    limit: number,
    offset: number,
    status?: DisputeStatus,
  ): Promise<PaginatedDisputes> {
    const where: Prisma.DisputeWhereInput = {
      ...(status ? { status } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.dispute.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          order: { select: { referenceCode: true, totalAmount: true } },
          buyer: { select: { name: true, phone: true } },
        },
      }),
      this.prisma.dispute.count({ where }),
    ]);

    return { items, total, limit, offset };
  }

  async resolveDispute(
    id: string,
    adminId: string,
    dto: ResolveDisputeDto,
  ): Promise<Dispute> {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id },
      include: {
        order: { select: { referenceCode: true, buyerId: true } },
        vendor: { select: { userId: true } },
      },
    });

    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    if (dispute.status !== DisputeStatus.OPEN) {
      throw new BadRequestException('Only OPEN disputes can be resolved');
    }

    const updated = await this.prisma.dispute.update({
      where: { id },
      data: {
        status: dto.status ?? DisputeStatus.RESOLVED,
        adminNotes: dto.adminNotes,
        resolvedAt: new Date(),
      },
    });

    this.logger.log(
      `Dispute resolved — id: ${id}, adminId: ${adminId}`,
    );

    const orderRef = dispute.order.referenceCode ?? id;

    // Notify buyer
    await this.notificationsService.create({
      userId: dispute.order.buyerId,
      type: NotificationType.DISPUTE_RESOLVED,
      title: 'Dispute Resolved',
      message: `Your dispute for order ${orderRef} has been resolved`,
      metadata: { disputeId: id },
    });

    // Notify vendor
    await this.notificationsService.create({
      userId: dispute.vendor.userId,
      type: NotificationType.DISPUTE_RESOLVED,
      title: 'Dispute Resolved',
      message: `A dispute for order ${orderRef} has been resolved by admin`,
      metadata: { disputeId: id },
    });

    return updated;
  }
}
