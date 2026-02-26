import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Order, OrderStatus, Prisma, RFQStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';

type OrderWithRelations = Prisma.OrderGetPayload<{
  include: { quote: true; rfq: true; payment: true };
}>;

type PaginatedOrders = {
  items: Order[];
  total: number;
  limit: number;
  offset: number;
};

const ALLOWED_ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.CONFIRMED]: [OrderStatus.OUT_FOR_DELIVERY, OrderStatus.CANCELLED],
  [OrderStatus.OUT_FOR_DELIVERY]: [OrderStatus.DELIVERED],
  [OrderStatus.DELIVERED]: [],
  [OrderStatus.CANCELLED]: [],
};

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(private readonly prisma: PrismaService) {}

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

    try {
      const createdOrder = await this.prisma.$transaction(async (tx) => {
        const now = new Date();

        const order = await tx.order.create({
          data: {
            rfqId: quote.rfqId,
            quoteId: quote.id,
            buyerId,
            vendorId: quote.vendorId,
            totalAmount: quote.totalAmount,
            status: OrderStatus.CONFIRMED,
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

        await tx.quote.update({
          where: { id: quote.id },
          data: {
            isWithdrawn: false,
          },
        });

        return order;
      });

      this.logger.log(`Order created id=${createdOrder.id} rfqId=${quote.rfqId}`);
      return createdOrder;
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Order already exists for this RFQ');
      }

      throw error;
    }
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
        quote: true,
        rfq: true,
        payment: true,
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

    this.logger.log(`Order cancelled id=${id} by role=${role}`);
    return cancelledOrder;
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

  private assertValidOrderTransition(
    current: OrderStatus,
    requested: OrderStatus,
  ): void {
    if (!ALLOWED_ORDER_TRANSITIONS[current].includes(requested)) {
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
