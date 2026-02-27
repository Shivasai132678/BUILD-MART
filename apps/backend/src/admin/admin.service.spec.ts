import { Prisma } from '@prisma/client';
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
    },
  } as unknown as PrismaService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AdminService(prisma);
  });

  describe('getMetrics', () => {
    it('returns correct counts for users, vendors, RFQs, orders', async () => {
      prisma.user.count.mockResolvedValue(50);
      prisma.vendorProfile.count
        .mockResolvedValueOnce(10) // totalVendors (isApproved: true)
        .mockResolvedValueOnce(3); // pendingVendors (isApproved: false)
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
        where: { isApproved: true, deletedAt: null },
      });
      expect(vpCountCalls[1][0]).toEqual({
        where: { isApproved: false, deletedAt: null },
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
    it('returns only vendors where isApproved = false', async () => {
      const pendingVendors = [
        {
          id: 'vp-1',
          businessName: 'Test Vendor',
          isApproved: false,
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
        isApproved: false,
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
});
