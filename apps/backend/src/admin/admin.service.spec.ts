import { NotFoundException } from '@nestjs/common';
import { OrderStatus, Prisma, VendorStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AdminService } from './admin.service';

describe('AdminService', () => {
  let service: AdminService;

  const prisma = {
    user: {
      count: jest.fn(),
    },
    vendorProfile: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    rFQ: {
      count: jest.fn(),
    },
    order: {
      count: jest.fn(),
      aggregate: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  } as unknown as jest.Mocked<PrismaService>;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AdminService(prisma);
  });

  describe('getMetrics', () => {
    it('returns correct counts for users, vendors, RFQs, orders', async () => {
      prisma.user.count.mockResolvedValue(50);
      prisma.vendorProfile.count
        .mockResolvedValueOnce(10) // totalVendors (status: APPROVED)
        .mockResolvedValueOnce(3); // pendingVendors (status: PENDING)
      prisma.rFQ.count.mockResolvedValue(25);
      prisma.order.count.mockResolvedValue(12);
      prisma.order.aggregate.mockResolvedValue({
        _sum: { totalAmount: new Prisma.Decimal('150000.50') },
      });

      const result = await service.getMetrics();

      expect(result).toEqual({
        totalUsers: 50,
        totalVendors: 10,
        pendingVendors: 3,
        totalRfqs: 25,
        totalOrders: 12,
        gmv: '150000.5',
      });
    });

    it('filters out soft-deleted records (deletedAt: null)', async () => {
      prisma.user.count.mockResolvedValue(5);
      prisma.vendorProfile.count
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(1);
      prisma.rFQ.count.mockResolvedValue(3);
      prisma.order.count.mockResolvedValue(1);
      prisma.order.aggregate.mockResolvedValue({
        _sum: { totalAmount: new Prisma.Decimal('5000.00') },
      });

      await service.getMetrics();

      // user.count called with deletedAt: null
      expect(prisma.user.count).toHaveBeenCalledWith({
        where: { deletedAt: null },
      });

      // vendorProfile.count called with deletedAt: null for both approved and pending
      const vpCountCalls = (prisma.vendorProfile.count as jest.Mock).mock.calls;
      expect(vpCountCalls[0][0]).toEqual({
        where: { status: VendorStatus.APPROVED, deletedAt: null },
      });
      expect(vpCountCalls[1][0]).toEqual({
        where: { status: VendorStatus.PENDING, deletedAt: null },
      });
    });

    it('returns GMV as sum of order amounts as a string', async () => {
      prisma.user.count.mockResolvedValue(0);
      prisma.vendorProfile.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);
      prisma.rFQ.count.mockResolvedValue(0);
      prisma.order.count.mockResolvedValue(3);
      prisma.order.aggregate.mockResolvedValue({
        _sum: { totalAmount: new Prisma.Decimal('99999.99') },
      });

      const result = await service.getMetrics();

      expect(result.gmv).toBe('99999.99');
      expect(typeof result.gmv).toBe('string');
    });

    it('returns zero values when no data exists (empty DB)', async () => {
      prisma.user.count.mockResolvedValue(0);
      prisma.vendorProfile.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);
      prisma.rFQ.count.mockResolvedValue(0);
      prisma.order.count.mockResolvedValue(0);
      prisma.order.aggregate.mockResolvedValue({
        _sum: { totalAmount: null },
      });

      const result = await service.getMetrics();

      expect(result).toEqual({
        totalUsers: 0,
        totalVendors: 0,
        pendingVendors: 0,
        totalRfqs: 0,
        totalOrders: 0,
        gmv: '0.00',
      });
    });
  });

  describe('getPendingVendors', () => {
    it('returns only vendors where status = PENDING', async () => {
      const pendingVendors = [
        {
          id: 'vp-1',
          businessName: 'Test Vendor',
          status: VendorStatus.PENDING,
          user: { name: 'Vendor User', phone: '+919000000004', email: null },
        },
      ];

      prisma.vendorProfile.findMany.mockResolvedValue(pendingVendors);
      prisma.vendorProfile.count.mockResolvedValue(1);

      const result = await service.getPendingVendors(20, 0);

      expect(result.data).toEqual(pendingVendors);
      expect(result.total).toBe(1);

      const findManyCall = (prisma.vendorProfile.findMany as jest.Mock).mock.calls[0][0];
      expect(findManyCall.where).toEqual({
        status: VendorStatus.PENDING,
        deletedAt: null,
      });
    });

    it('returns empty array if no pending vendors', async () => {
      prisma.vendorProfile.findMany.mockResolvedValue([]);
      prisma.vendorProfile.count.mockResolvedValue(0);

      const result = await service.getPendingVendors(20, 0);

      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('returns paginated results with correct limit and offset', async () => {
      prisma.vendorProfile.findMany.mockResolvedValue([]);
      prisma.vendorProfile.count.mockResolvedValue(50);

      const result = await service.getPendingVendors(10, 20);

      expect(result.limit).toBe(10);
      expect(result.offset).toBe(20);

      const findManyCall = (prisma.vendorProfile.findMany as jest.Mock).mock.calls[0][0];
      expect(findManyCall.take).toBe(10);
      expect(findManyCall.skip).toBe(20);
    });

    it('sanitizes negative limit and offset to safe values', async () => {
      prisma.vendorProfile.findMany.mockResolvedValue([]);
      prisma.vendorProfile.count.mockResolvedValue(0);

      const result = await service.getPendingVendors(-5, -10);

      expect(result.limit).toBe(1);
      expect(result.offset).toBe(0);

      const findManyCall = (prisma.vendorProfile.findMany as jest.Mock).mock.calls[0][0];
      expect(findManyCall.take).toBe(1);
      expect(findManyCall.skip).toBe(0);
    });

    it('includes user relation with name, phone, email', async () => {
      prisma.vendorProfile.findMany.mockResolvedValue([]);
      prisma.vendorProfile.count.mockResolvedValue(0);

      await service.getPendingVendors(20, 0);

      const findManyCall = (prisma.vendorProfile.findMany as jest.Mock).mock.calls[0][0];
      expect(findManyCall.include).toEqual({
        user: {
          select: {
            name: true,
            phone: true,
            email: true,
          },
        },
      });
    });

    it('orders results by createdAt ascending', async () => {
      prisma.vendorProfile.findMany.mockResolvedValue([]);
      prisma.vendorProfile.count.mockResolvedValue(0);

      await service.getPendingVendors(20, 0);

      const findManyCall = (prisma.vendorProfile.findMany as jest.Mock).mock.calls[0][0];
      expect(findManyCall.orderBy).toEqual({ createdAt: 'asc' });
    });
  });

  describe('listAllOrders', () => {
    it('returns paginated orders for admin', async () => {
      const fakeOrders = [{ id: 'order-1' }, { id: 'order-2' }];
      (prisma.$transaction as jest.Mock).mockResolvedValue([fakeOrders, 2]);

      const result = await service.listAllOrders(10, 0);

      expect(result.items).toEqual(fakeOrders);
      expect(result.total).toBe(2);
      expect(result.limit).toBe(10);
      expect(result.offset).toBe(0);
    });

    it('filters by status when provided', async () => {
      (prisma.$transaction as jest.Mock).mockResolvedValue([[], 0]);

      await service.listAllOrders(10, 0, OrderStatus.CONFIRMED);

      // $transaction uses the array form: prisma.$transaction([findMany(...), count(...)])
      // order.findMany is called first and its arguments are captured before being
      // passed to $transaction, so we can assert the where clause directly.
      const findManyCall = (prisma.order.findMany as jest.Mock).mock.calls[0][0];
      expect(findManyCall.where).toEqual({ status: OrderStatus.CONFIRMED });
    });

    it('sanitizes negative limit and offset', async () => {
      (prisma.$transaction as jest.Mock).mockResolvedValue([[], 0]);

      const result = await service.listAllOrders(-5, -10);

      expect(result.limit).toBe(1);
      expect(result.offset).toBe(0);
    });

    it('returns empty items when no orders exist', async () => {
      (prisma.$transaction as jest.Mock).mockResolvedValue([[], 0]);

      const result = await service.listAllOrders(20, 0);

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('getOrderById', () => {
    it('returns order detail when found', async () => {
      const fakeOrder = {
        id: 'order-1',
        quote: { items: [] },
        rfq: {},
        payment: null,
      };
      (prisma.order.findUnique as jest.Mock).mockResolvedValue(fakeOrder);

      const result = await service.getOrderById('order-1');

      expect(result).toEqual(fakeOrder);
      expect(prisma.order.findUnique).toHaveBeenCalledWith({
        where: { id: 'order-1' },
        include: {
          quote: { include: { items: true } },
          rfq: true,
          payment: true,
        },
      });
    });

    it('throws NotFoundException when order does not exist', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.getOrderById('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
