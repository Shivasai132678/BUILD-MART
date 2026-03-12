import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Order, OrderStatus, Prisma, RFQ, User, VendorStatus } from '@prisma/client';
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

type AdminUserListResponse = {
  items: User[];
  total: number;
  limit: number;
  offset: number;
};

type AdminVendorListItem = Prisma.VendorProfileGetPayload<{
  include: {
    user: {
      select: { name: true; phone: true; email: true };
    };
  };
}>;

type AdminVendorListResponse = {
  items: AdminVendorListItem[];
  total: number;
  limit: number;
  offset: number;
};

type AdminRfqListResponse = {
  items: RFQ[];
  total: number;
  limit: number;
  offset: number;
};

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

  async getAllUsers(
    limit: number,
    offset: number,
  ): Promise<AdminUserListResponse> {
    const safeLimit = Math.max(1, limit);
    const safeOffset = Math.max(0, offset);
    const where: Prisma.UserWhereInput = { deletedAt: null };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        skip: safeOffset,
        take: safeLimit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);
    this.logger.log(`Admin users listed count=${items.length} total=${total}`);
    return { items, total, limit: safeLimit, offset: safeOffset };
  }

  async getAllVendors(
    limit: number,
    offset: number,
    status?: VendorStatus,
  ): Promise<AdminVendorListResponse> {
    const safeLimit = Math.max(1, limit);
    const safeOffset = Math.max(0, offset);
    const where: Prisma.VendorProfileWhereInput = {
      deletedAt: null,
      ...(status !== undefined ? { status } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.vendorProfile.findMany({
        where,
        include: { user: { select: { name: true, phone: true, email: true } } },
        skip: safeOffset,
        take: safeLimit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.vendorProfile.count({ where }),
    ]);
    this.logger.log(`Admin vendors listed count=${items.length} total=${total}`);
    return { items, total, limit: safeLimit, offset: safeOffset };
  }

  async getAllRfqs(
    limit: number,
    offset: number,
  ): Promise<AdminRfqListResponse> {
    const safeLimit = Math.max(1, limit);
    const safeOffset = Math.max(0, offset);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.rFQ.findMany({
        skip: safeOffset,
        take: safeLimit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.rFQ.count(),
    ]);
    this.logger.log(`Admin rfqs listed count=${items.length} total=${total}`);
    return { items, total, limit: safeLimit, offset: safeOffset };
  }
}
