import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Order, OrderStatus, Prisma, VendorStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type AdminMetricsResponse = {
  totalUsers: number;
  totalVendors: number;
  pendingVendors: number;
  totalRfqs: number;
  totalOrders: number;
  gmv: string;
};

type PendingVendorListItem = Prisma.VendorProfileGetPayload<{
  include: {
    user: {
      select: {
        name: true;
        phone: true;
        email: true;
      };
    };
  };
}>;

type PendingVendorsResponse = {
  data: PendingVendorListItem[];
  total: number;
  limit: number;
  offset: number;
};

type AdminOrderListResponse = {
  items: Order[];
  total: number;
  limit: number;
  offset: number;
};

type AdminOrderDetail = Prisma.OrderGetPayload<{
  include: { quote: { include: { items: true } }; rfq: true; payment: true };
}>;

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getMetrics(): Promise<AdminMetricsResponse> {
    const [
      totalUsers,
      totalVendors,
      pendingVendors,
      totalRfqs,
      totalOrders,
      gmvAggregate,
    ] = await Promise.all([
      this.prisma.user.count({
        where: {
          deletedAt: null,
        },
      }),
      this.prisma.vendorProfile.count({
        where: {
          status: VendorStatus.APPROVED,
          deletedAt: null,
        },
      }),
      this.prisma.vendorProfile.count({
        where: {
          status: VendorStatus.PENDING,
          deletedAt: null,
        },
      }),
      this.prisma.rFQ.count(),
      this.prisma.order.count(),
      this.prisma.order.aggregate({
        _sum: {
          totalAmount: true,
        },
      }),
    ]);

    const gmvDecimal = gmvAggregate._sum.totalAmount;
    const gmv = gmvDecimal ? gmvDecimal.toString() : '0.00';

    this.logger.log(
      `Admin metrics fetched users=${totalUsers} vendors=${totalVendors} pending=${pendingVendors} rfqs=${totalRfqs} orders=${totalOrders} gmv=${gmv}`,
    );

    return {
      totalUsers,
      totalVendors,
      pendingVendors,
      totalRfqs,
      totalOrders,
      gmv,
    };
  }

  async getPendingVendors(
    limit: number,
    offset: number,
  ): Promise<PendingVendorsResponse> {
    const safeLimit = Math.max(1, limit);
    const safeOffset = Math.max(0, offset);

    const where: Prisma.VendorProfileWhereInput = {
      status: VendorStatus.PENDING,
      deletedAt: null,
    };

    const [data, total] = await Promise.all([
      this.prisma.vendorProfile.findMany({
        where,
        include: {
          user: {
            select: {
              name: true,
              phone: true,
              email: true,
            },
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
        take: safeLimit,
        skip: safeOffset,
      }),
      this.prisma.vendorProfile.count({ where }),
    ]);

    this.logger.log(
      `Pending vendors fetched count=${data.length} total=${total} limit=${safeLimit} offset=${safeOffset}`,
    );

    return {
      data,
      total,
      limit: safeLimit,
      offset: safeOffset,
    };
  }

  async listAllOrders(
    limit: number,
    offset: number,
    status?: OrderStatus,
  ): Promise<AdminOrderListResponse> {
    const safeLimit = Math.max(1, limit);
    const safeOffset = Math.max(0, offset);

    const where: Prisma.OrderWhereInput = status !== undefined ? { status } : {};

    const [items, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        skip: safeOffset,
        take: safeLimit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.order.count({ where }),
    ]);

    this.logger.log(
      `Admin orders listed count=${items.length} total=${total} limit=${safeLimit} offset=${safeOffset}`,
    );

    return { items, total, limit: safeLimit, offset: safeOffset };
  }

  async getOrderById(id: string): Promise<AdminOrderDetail> {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        quote: { include: { items: true } },
        rfq: true,
        payment: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    this.logger.log(`Admin fetched order id=${id}`);
    return order;
  }
}
