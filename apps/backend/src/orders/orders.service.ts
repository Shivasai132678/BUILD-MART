import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  NotificationType,
  Order,
  OrderStatus,
  Prisma,
  Review,
  RFQStatus,
  UserRole,
  VendorStatus,
} from '@prisma/client';
import { isValidOrderStatusTransition } from '../common/constants/status-transitions';
import { generateOrderReferenceCode } from '../common/utils/reference-code';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { CreateDirectOrderDto } from './dto/create-direct-order.dto';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';

type OrderWithRelations = Prisma.OrderGetPayload<{
  include: {
    quote: { include: { items: true } };
    rfq: true;
    payment: true;
    review: true;
    vendor: { select: { businessName: true } };
  };
}>;

type PaginatedOrders = {
  items: Order[];
  total: number;
  limit: number;
  offset: number;
};

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async createOrder(buyerId: string, dto: CreateOrderDto): Promise<Order> {
    const quote = await this.prisma.quote.findUnique({
      where: { id: dto.quoteId },
      include: {
        rfq: {
          select: {
            id: true,
            buyerId: true,
            status: true,
          },
        },
      },
    });

    if (!quote) {
      throw new NotFoundException('Quote not found');
    }

    if (quote.rfq.buyerId !== buyerId) {
      throw new ForbiddenException('Quote does not belong to your RFQ');
    }

    if (quote.validUntil.getTime() < Date.now()) {
      throw new BadRequestException('Quote has expired');
    }

    if (quote.isWithdrawn) {
      throw new BadRequestException('Quote has been withdrawn');
    }

    if (quote.rfq.status !== RFQStatus.OPEN && quote.rfq.status !== RFQStatus.QUOTED) {
      throw new BadRequestException('RFQ status must be OPEN or QUOTED');
    }

    const existingOrder = await this.prisma.order.findUnique({
      where: { rfqId: quote.rfqId },
      select: { id: true },
    });

    if (existingOrder) {
      throw new ConflictException('Order already exists for this RFQ');
    }

    const MAX_REF_RETRIES = 3;

    for (let attempt = 0; attempt < MAX_REF_RETRIES; attempt++) {
      try {
        const createdOrder = await this.prisma.$transaction(async (tx) => {
          const now = new Date();
          const referenceCode = await generateOrderReferenceCode(tx);

          const order = await tx.order.create({
            data: {
              rfqId: quote.rfqId,
              quoteId: quote.id,
              buyerId,
              vendorId: quote.vendorId,
              totalAmount: quote.totalAmount,
              status: OrderStatus.CONFIRMED,
              referenceCode,
              confirmedAt: now,
            },
          });

          await tx.rFQ.update({
            where: { id: quote.rfqId },
            data: {
              status: RFQStatus.CLOSED,
              closedAt: now,
            },
          });

          return order;
        });

        this.logger.log(`Order created id=${createdOrder.id} rfqId=${quote.rfqId}`);

        try {
          const orderRef = createdOrder.referenceCode ?? `#${createdOrder.id.slice(0, 8)}`;
          await this.notificationsService.create({
            userId: buyerId,
            type: NotificationType.ORDER_CONFIRMED,
            title: 'Order confirmed',
            message: `Your order ${orderRef} has been confirmed.`,
            metadata: {
              orderId: createdOrder.id,
              rfqId: quote.rfqId,
            },
          });
        } catch (notifError) {
          this.logger.error(
            `Failed to send ORDER_CONFIRMED notification for orderId=${createdOrder.id} rfqId=${quote.rfqId}`,
            notifError instanceof Error ? notifError.stack : notifError,
          );
        }

        return createdOrder;
      } catch (error: unknown) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          const targets = (error.meta?.target as string[] | string) ?? [];
          const targetStr = Array.isArray(targets) ? targets.join(',') : targets;

          if (targetStr.includes('referenceCode')) {
            this.logger.warn(`Reference code collision on order create, attempt ${attempt + 1}/${MAX_REF_RETRIES}`);
            if (attempt < MAX_REF_RETRIES - 1) continue;
            throw new ConflictException('Unable to generate unique order reference code, please retry');
          }

          throw new ConflictException('Order already exists for this RFQ');
        }

        throw error;
      }
    }

    // Unreachable, but satisfies TypeScript
    throw new ConflictException('Unable to create order');
  }

  async createDirectOrder(buyerId: string, dto: CreateDirectOrderDto): Promise<Order> {
    // Validate vendor is APPROVED
    const vendor = await this.prisma.vendorProfile.findUnique({
      where: { id: dto.vendorId },
      select: { id: true, status: true, userId: true },
    });

    if (!vendor || vendor.status !== VendorStatus.APPROVED) {
      throw new NotFoundException('Vendor not found or not available');
    }

    if (vendor.userId === buyerId) {
      throw new ForbiddenException('You cannot place a direct order with yourself');
    }

    // Validate address belongs to buyer
    const address = await this.prisma.address.findUnique({
      where: { id: dto.addressId },
      select: { id: true, userId: true },
    });

    if (!address || address.userId !== buyerId) {
      throw new NotFoundException('Delivery address not found');
    }

    // Validate all products belong to this vendor and are in stock
    const productIds = dto.items.map((i) => i.productId);
    const vendorProducts = await this.prisma.vendorProduct.findMany({
      where: { vendorId: dto.vendorId, productId: { in: productIds }, stockAvailable: true },
      include: {
        product: { select: { id: true, name: true, unit: true, basePrice: true, isActive: true, deletedAt: true } },
      },
    });

    const vendorProductMap = new Map(vendorProducts.map((vp) => [vp.productId, vp]));

    for (const item of dto.items) {
      const vp = vendorProductMap.get(item.productId);
      if (!vp || !vp.product.isActive || vp.product.deletedAt) {
        throw new BadRequestException(`Product ${item.productId} is not available from this vendor`);
      }
    }

    // Calculate order total using Decimal arithmetic (Rule 3/4)
    const lineItems = dto.items.map((item) => {
      const vp = vendorProductMap.get(item.productId)!;
      const unitPrice = vp.customPrice ?? vp.product.basePrice;
      const qty = new Prisma.Decimal(item.quantity);
      const subtotal = unitPrice.mul(qty);
      return {
        productId: item.productId,
        productName: vp.product.name,
        quantity: qty,
        unit: vp.product.unit,
        unitPrice,
        subtotal,
      };
    });

    const totalAmount = lineItems.reduce(
      (acc, li) => acc.add(li.subtotal),
      new Prisma.Decimal(0),
    );

    const MAX_REF_RETRIES = 3;

    for (let attempt = 0; attempt < MAX_REF_RETRIES; attempt++) {
      try {
        const createdOrder = await this.prisma.$transaction(async (tx) => {
          const now = new Date();
          const referenceCode = await generateOrderReferenceCode(tx);

          const order = await tx.order.create({
            data: {
              buyerId,
              vendorId: dto.vendorId,
              totalAmount,
              status: OrderStatus.CONFIRMED,
              referenceCode,
              confirmedAt: now,
              directItems: {
                create: lineItems.map((li) => ({
                  productId: li.productId,
                  productName: li.productName,
                  quantity: li.quantity,
                  unit: li.unit,
                  unitPrice: li.unitPrice,
                  subtotal: li.subtotal,
                })),
              },
            },
          });

          return order;
        });

        this.logger.log(`Direct order created id=${createdOrder.id} buyerId=${buyerId} vendorId=${dto.vendorId}`);

        try {
          const orderRef = createdOrder.referenceCode ?? `#${createdOrder.id.slice(0, 8)}`;
          await this.notificationsService.create({
            userId: buyerId,
            type: NotificationType.ORDER_CONFIRMED,
            title: 'Order confirmed',
            message: `Your direct order ${orderRef} has been confirmed.`,
            metadata: { orderId: createdOrder.id },
          });
        } catch (notifError) {
          this.logger.error(
            `Failed to send ORDER_CONFIRMED notification for direct orderId=${createdOrder.id}`,
            notifError instanceof Error ? notifError.stack : notifError,
          );
        }

        return createdOrder;
      } catch (error: unknown) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          const targets = (error.meta?.target as string[] | string) ?? [];
          const targetStr = Array.isArray(targets) ? targets.join(',') : targets;
          if (targetStr.includes('referenceCode')) {
            this.logger.warn(`Reference code collision on direct order create, attempt ${attempt + 1}/${MAX_REF_RETRIES}`);
            if (attempt < MAX_REF_RETRIES - 1) continue;
            throw new ConflictException('Unable to generate unique order reference code, please retry');
          }
        }
        throw error;
      }
    }

    throw new ConflictException('Unable to create order');
  }

  async listOrders(
    userId: string,
    role: UserRole,
    limit: number,
    offset: number,
    status?: OrderStatus,
  ): Promise<PaginatedOrders> {
    const where = await this.buildOrderListWhere(userId, role, status);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.order.count({ where }),
    ]);

    return { items, total, limit, offset };
  }

  async getOrder(id: string, userId: string, role: UserRole): Promise<OrderWithRelations> {
    const where = await this.buildOrderAccessWhere(id, userId, role);

    const order = await this.prisma.order.findFirst({
      where,
      include: {
        quote: { include: { items: true } },
        rfq: true,
        payment: true,
        review: true,
        vendor: { select: { businessName: true } },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  async updateOrderStatus(
    id: string,
    vendorUserId: string,
    dto: UpdateOrderStatusDto,
  ): Promise<Order> {
    const vendorProfileId = await this.getVendorProfileIdByUserId(vendorUserId);
    const existingOrder = await this.prisma.order.findUnique({
      where: { id },
    });

    if (!existingOrder) {
      throw new NotFoundException('Order not found');
    }

    if (existingOrder.vendorId !== vendorProfileId) {
      throw new ForbiddenException('You are not allowed to update this order');
    }

    this.assertValidOrderTransition(existingOrder.status, dto.status);

    const updatedOrder = await this.prisma.order.update({
      where: { id },
      data: this.buildStatusUpdateData(dto.status),
    });

    this.logger.log(
      `Order status updated id=${id} ${existingOrder.status} -> ${dto.status}`,
    );

    if (
      dto.status === OrderStatus.OUT_FOR_DELIVERY ||
      dto.status === OrderStatus.DELIVERED
    ) {
      const orderRef = updatedOrder.referenceCode ?? `#${updatedOrder.id.slice(0, 8)}`;
      const statusLabel = dto.status === OrderStatus.OUT_FOR_DELIVERY ? 'out for delivery' : 'delivered';
      await this.notificationsService.create({
        userId: updatedOrder.buyerId,
        type: NotificationType.STATUS_UPDATED,
        title: 'Order status updated',
        message: `Your order ${orderRef} is now ${statusLabel}.`,
        metadata: {
          orderId: updatedOrder.id,
          status: dto.status,
        },
      });
    }

    return updatedOrder;
  }

  async cancelOrder(
    id: string,
    userId: string,
    role: UserRole,
    cancelReason?: string,
  ): Promise<Order> {
    const existingOrder = await this.prisma.order.findUnique({
      where: { id },
    });

    if (!existingOrder) {
      throw new NotFoundException('Order not found');
    }

    if (role === UserRole.BUYER) {
      if (existingOrder.buyerId !== userId) {
        throw new ForbiddenException('You are not allowed to cancel this order');
      }
    } else if (role === UserRole.VENDOR) {
      const vendorProfileId = await this.getVendorProfileIdByUserId(userId);
      if (existingOrder.vendorId !== vendorProfileId) {
        throw new ForbiddenException('You are not allowed to cancel this order');
      }
    } else {
      throw new ForbiddenException('Order cancellation is not allowed for this role');
    }

    if (existingOrder.status !== OrderStatus.CONFIRMED) {
      throw new BadRequestException('Order can only be cancelled from CONFIRMED state');
    }

    const cancelledOrder = await this.prisma.order.update({
      where: { id },
      data: {
        status: OrderStatus.CANCELLED,
        cancelledAt: new Date(),
        ...(cancelReason !== undefined ? { cancelReason } : {}),
      },
    });

    const vendorUserId = await this.getVendorUserIdByVendorProfileId(existingOrder.vendorId);
    const recipientIds = Array.from(new Set([existingOrder.buyerId, vendorUserId]));

    const cancelledOrderRef = cancelledOrder.referenceCode ?? `#${cancelledOrder.id.slice(0, 8)}`;
    await Promise.allSettled(
      recipientIds.map((recipientId) =>
        this.notificationsService.create({
          userId: recipientId,
          type: NotificationType.STATUS_UPDATED,
          title: 'Order cancelled',
          message: `Order ${cancelledOrderRef} was cancelled.`,
          metadata: {
            orderId: cancelledOrder.id,
            status: OrderStatus.CANCELLED,
          },
        }),
      ),
    );

    this.logger.log(`Order cancelled id=${id} by role=${role}`);
    return cancelledOrder;
  }

  async submitReview(
    orderId: string,
    buyerId: string,
    dto: CreateReviewDto,
  ): Promise<Review> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        buyerId: true,
        vendorId: true,
        status: true,
        review: { select: { id: true } },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.buyerId !== buyerId) {
      throw new ForbiddenException('You are not allowed to review this order');
    }

    if (order.status !== OrderStatus.DELIVERED) {
      throw new BadRequestException('Reviews can only be submitted for delivered orders');
    }

    if (order.review) {
      throw new ConflictException('A review has already been submitted for this order');
    }

    const review = await this.prisma.$transaction(async (tx) => {
      const created = await tx.review.create({
        data: {
          orderId,
          buyerId,
          vendorId: order.vendorId,
          rating: dto.rating,
          ...(dto.comment !== undefined ? { comment: dto.comment } : {}),
        },
      });

      // Recalculate averageRating and totalReviews atomically
      const aggregate = await tx.review.aggregate({
        where: { vendorId: order.vendorId },
        _avg: { rating: true },
        _count: { id: true },
      });

      await tx.vendorProfile.update({
        where: { id: order.vendorId },
        data: {
          averageRating: aggregate._avg.rating ?? 0,
          totalReviews: aggregate._count.id,
        },
      });

      return created;
    });

    this.logger.log(`Review submitted orderId=${orderId} vendorId=${order.vendorId} rating=${dto.rating}`);

    return review;
  }

  private async buildOrderListWhere(
    userId: string,
    role: UserRole,
    status?: OrderStatus,
  ): Promise<Prisma.OrderWhereInput> {
    const where: Prisma.OrderWhereInput = {};

    if (role === UserRole.BUYER) {
      where.buyerId = userId;
    } else if (role === UserRole.VENDOR) {
      where.vendorId = await this.getVendorProfileIdByUserId(userId);
    } else {
      throw new ForbiddenException('Order listing is not allowed for this role');
    }

    if (status !== undefined) {
      where.status = status;
    }

    return where;
  }

  private async buildOrderAccessWhere(
    id: string,
    userId: string,
    role: UserRole,
  ): Promise<Prisma.OrderWhereInput> {
    if (role === UserRole.BUYER) {
      return {
        id,
        buyerId: userId,
      };
    }

    if (role === UserRole.VENDOR) {
      const vendorProfileId = await this.getVendorProfileIdByUserId(userId);
      return {
        id,
        vendorId: vendorProfileId,
      };
    }

    throw new ForbiddenException('Order access is not allowed for this role');
  }

  private async getVendorProfileIdByUserId(userId: string): Promise<string> {
    const vendorProfile = await this.prisma.vendorProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!vendorProfile) {
      throw new NotFoundException('Vendor profile not found');
    }

    return vendorProfile.id;
  }

  private async getVendorUserIdByVendorProfileId(vendorProfileId: string): Promise<string> {
    const vendorProfile = await this.prisma.vendorProfile.findUnique({
      where: { id: vendorProfileId },
      select: { userId: true },
    });

    if (!vendorProfile) {
      throw new NotFoundException('Vendor profile not found');
    }

    return vendorProfile.userId;
  }

  private assertValidOrderTransition(
    current: OrderStatus,
    requested: OrderStatus,
  ): void {
    if (!isValidOrderStatusTransition(current, requested)) {
      throw new BadRequestException(
        `Invalid transition from ${current} to ${requested}`,
      );
    }
  }

  private buildStatusUpdateData(nextStatus: OrderStatus): Prisma.OrderUpdateInput {
    const now = new Date();

    if (nextStatus === OrderStatus.OUT_FOR_DELIVERY) {
      return {
        status: nextStatus,
        dispatchedAt: now,
      };
    }

    if (nextStatus === OrderStatus.DELIVERED) {
      return {
        status: nextStatus,
        deliveredAt: now,
      };
    }

    if (nextStatus === OrderStatus.CANCELLED) {
      return {
        status: nextStatus,
        cancelledAt: now,
      };
    }

    return {
      status: nextStatus,
    };
  }
}
