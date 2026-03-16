import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { NotificationType, Order, OrderStatus, Prisma, RFQ, User, VendorStatus } from '@prisma/client';
import { AuditLogService } from '../common/audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
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

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly notificationsService: NotificationsService,
  ) {}

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

  async forceCancelOrder(id: string, adminUserId: string): Promise<Order> {
    const existing = await this.prisma.order.findUnique({
      where: { id },
      include: {
        rfq: { select: { buyerId: true } },
        vendor: { select: { userId: true } },
      },
    });

    if (!existing) {
      throw new NotFoundException('Order not found');
    }

    // State machine check (Rule 19): only non-terminal orders can be force-cancelled
    const nonCancellableStatuses: OrderStatus[] = [OrderStatus.CANCELLED, OrderStatus.DELIVERED];
    if (nonCancellableStatuses.includes(existing.status)) {
      throw new BadRequestException(
        `Cannot force-cancel an order with status ${existing.status}`,
      );
    }

    const updated = await this.prisma.order.update({
      where: { id },
      data: {
        status: OrderStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelReason: 'Admin force-cancelled',
      },
    });

    await this.auditLogService.log({
      userId: adminUserId,
      action: 'ADMIN_FORCE_CANCEL_ORDER',
      entityType: 'Order',
      entityId: id,
      oldValue: { status: existing.status } as Record<string, unknown>,
      newValue: { status: OrderStatus.CANCELLED } as Record<string, unknown>,
    });

    this.logger.log(`Admin force-cancelled order id=${id} by adminUserId=${adminUserId}`);

    // Notify buyer and vendor (Rule 15)
    const buyerId = existing.rfq?.buyerId;
    const vendorUserId = existing.vendor?.userId;

    if (buyerId) {
      this.notificationsService.create({
        userId: buyerId,
        type: NotificationType.STATUS_UPDATED,
        title: 'Order cancelled by admin',
        message: `Your order #${id.slice(0, 8)} has been cancelled by the platform administrator.`,
        metadata: { orderId: id },
      }).catch((err: unknown) => {
        this.logger.error(
          `Failed to notify buyer of admin cancel orderId=${id}: ${err instanceof Error ? err.message : 'Unknown error'}`,
        );
      });
    }

    if (vendorUserId) {
      this.notificationsService.create({
        userId: vendorUserId,
        type: NotificationType.STATUS_UPDATED,
        title: 'Order cancelled by admin',
        message: `Order #${id.slice(0, 8)} has been cancelled by the platform administrator.`,
        metadata: { orderId: id },
      }).catch((err: unknown) => {
        this.logger.error(
          `Failed to notify vendor of admin cancel orderId=${id}: ${err instanceof Error ? err.message : 'Unknown error'}`,
        );
      });
    }

    return updated;
  }

  async flagOrder(id: string, adminUserId: string, reason: string): Promise<Order> {
    const existing = await this.prisma.order.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Order not found');
    }

    // Store flag reason in cancelReason using a FLAG: prefix as a workaround
    // since the schema has no dedicated flagged field.
    const updated = await this.prisma.order.update({
      where: { id },
      data: {
        cancelReason: `FLAG: ${reason}`,
      },
    });

    await this.auditLogService.log({
      userId: adminUserId,
      action: 'ADMIN_FLAG_ORDER',
      entityType: 'Order',
      entityId: id,
      oldValue: null,
      newValue: { reason } as Record<string, unknown>,
    });

    this.logger.log(`Admin flagged order id=${id} reason="${reason}" by adminUserId=${adminUserId}`);

    return updated;
  }

  async bulkApproveVendors(
    vendorIds: string[],
    adminUserId: string,
  ): Promise<{ approved: number; skipped: number }> {
    const vendors = await this.prisma.vendorProfile.findMany({
      where: { id: { in: vendorIds }, status: VendorStatus.PENDING },
      include: { user: { select: { id: true } } },
    });

    if (vendors.length === 0) {
      return { approved: 0, skipped: vendorIds.length };
    }

    const now = new Date();

    await this.prisma.$transaction([
      this.prisma.vendorProfile.updateMany({
        where: { id: { in: vendors.map((v) => v.id) } },
        data: { status: VendorStatus.APPROVED, approvedAt: now },
      }),
      this.prisma.user.updateMany({
        where: { id: { in: vendors.map((v) => v.userId) } },
        data: { role: 'VENDOR' },
      }),
    ]);

    await Promise.allSettled(
      vendors.map((v) =>
        this.notificationsService.create({
          userId: v.userId,
          type: NotificationType.VENDOR_APPROVED,
          title: 'Vendor application approved',
          message: 'Your vendor application has been approved. You can now submit quotes.',
          metadata: { vendorId: v.id },
        }),
      ),
    );

    this.logger.log(`Bulk approved ${vendors.length} vendors by adminUserId=${adminUserId}`);
    return { approved: vendors.length, skipped: vendorIds.length - vendors.length };
  }

  async bulkSuspendVendors(
    vendorIds: string[],
    adminUserId: string,
  ): Promise<{ suspended: number; skipped: number }> {
    const vendors = await this.prisma.vendorProfile.findMany({
      where: { id: { in: vendorIds }, status: VendorStatus.APPROVED },
      include: { user: { select: { id: true } } },
    });

    if (vendors.length === 0) {
      return { suspended: 0, skipped: vendorIds.length };
    }

    await this.prisma.vendorProfile.updateMany({
      where: { id: { in: vendors.map((v) => v.id) } },
      data: { status: VendorStatus.SUSPENDED },
    });

    await Promise.allSettled(
      vendors.map((v) =>
        this.notificationsService.create({
          userId: v.userId,
          type: NotificationType.VENDOR_SUSPENDED,
          title: 'Vendor account suspended',
          message: 'Your vendor account has been suspended by the admin.',
          metadata: { vendorId: v.id },
        }),
      ),
    );

    this.logger.log(`Bulk suspended ${vendors.length} vendors by adminUserId=${adminUserId}`);
    return { suspended: vendors.length, skipped: vendorIds.length - vendors.length };
  }
}
