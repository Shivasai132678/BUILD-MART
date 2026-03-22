import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DisputeStatus, NotificationType } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { DisputesService } from './disputes.service';

describe('DisputesService', () => {
  let service: DisputesService;

  const prisma = {
    order: {
      findUnique: jest.fn(),
    },
    dispute: {
      findFirst: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    vendorProfile: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  } as unknown as jest.Mocked<PrismaService>;

  const notificationsService = {
    create: jest.fn().mockResolvedValue(undefined),
  } as unknown as NotificationsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DisputesService(prisma, notificationsService);
  });

  describe('createDispute', () => {
    const dto = {
      orderId: 'order-1',
      reason: 'Damaged goods',
      description: 'Bags were torn',
    };

    it('creates dispute for delivered order owned by buyer', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue({
        id: 'order-1',
        buyerId: 'buyer-1',
        vendorId: 'vendor-profile-1',
        status: 'DELIVERED',
        referenceCode: 'ORD-0001',
        vendor: { userId: 'vendor-user-1', businessName: 'Vendor X' },
      });
      (prisma.dispute.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.dispute.create as jest.Mock).mockResolvedValue({
        id: 'dispute-1',
        orderId: 'order-1',
        buyerId: 'buyer-1',
        vendorId: 'vendor-profile-1',
      });

      const result = await service.createDispute('buyer-1', dto);

      expect(result.id).toBe('dispute-1');
      expect(notificationsService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'vendor-user-1',
          type: NotificationType.DISPUTE_OPENED,
        }),
      );
    });

    it('throws when order does not exist', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.createDispute('buyer-1', dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws when buyer does not own order', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue({
        id: 'order-1',
        buyerId: 'buyer-2',
        vendorId: 'vendor-profile-1',
        status: 'DELIVERED',
        vendor: { userId: 'vendor-user-1' },
      });

      await expect(service.createDispute('buyer-1', dto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws when order is not delivered', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue({
        id: 'order-1',
        buyerId: 'buyer-1',
        vendorId: 'vendor-profile-1',
        status: 'CONFIRMED',
        vendor: { userId: 'vendor-user-1' },
      });

      await expect(service.createDispute('buyer-1', dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws when dispute already exists for order', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue({
        id: 'order-1',
        buyerId: 'buyer-1',
        vendorId: 'vendor-profile-1',
        status: 'DELIVERED',
        vendor: { userId: 'vendor-user-1' },
      });
      (prisma.dispute.findFirst as jest.Mock).mockResolvedValue({ id: 'd-1' });

      await expect(service.createDispute('buyer-1', dto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('list methods', () => {
    it('lists buyer disputes with pagination', async () => {
      (prisma.$transaction as jest.Mock).mockResolvedValue([[{ id: 'd-1' }], 1]);

      const result = await service.listBuyerDisputes('buyer-1', 10, 0, DisputeStatus.OPEN);

      expect(result).toEqual({ items: [{ id: 'd-1' }], total: 1, limit: 10, offset: 0 });
    });

    it('lists vendor disputes with pagination', async () => {
      (prisma.$transaction as jest.Mock).mockResolvedValue([[{ id: 'd-1' }], 1]);

      const result = await service.listVendorDisputes('vendor-1', 20, 5);

      expect(result.limit).toBe(20);
      expect(result.offset).toBe(5);
      expect(result.total).toBe(1);
    });

    it('lists all disputes for admin', async () => {
      (prisma.$transaction as jest.Mock).mockResolvedValue([[], 0]);

      const result = await service.listAllDisputes(25, 0);

      expect(result).toEqual({ items: [], total: 0, limit: 25, offset: 0 });
    });
  });

  describe('getDispute', () => {
    it('returns dispute for buyer', async () => {
      (prisma.dispute.findUnique as jest.Mock).mockResolvedValue({
        id: 'd-1',
        buyerId: 'buyer-1',
        vendorId: 'vendor-1',
      });

      const result = await service.getDispute('d-1', 'buyer-1');
      expect(result.id).toBe('d-1');
    });

    it('returns dispute for matching vendor user', async () => {
      (prisma.dispute.findUnique as jest.Mock).mockResolvedValue({
        id: 'd-1',
        buyerId: 'buyer-1',
        vendorId: 'vendor-1',
      });
      (prisma.vendorProfile.findUnique as jest.Mock).mockResolvedValue({ id: 'vendor-1' });

      const result = await service.getDispute('d-1', 'vendor-user-1');
      expect(result.id).toBe('d-1');
    });

    it('throws not found for missing dispute', async () => {
      (prisma.dispute.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.getDispute('missing', 'buyer-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws forbidden for unrelated user', async () => {
      (prisma.dispute.findUnique as jest.Mock).mockResolvedValue({
        id: 'd-1',
        buyerId: 'buyer-1',
        vendorId: 'vendor-1',
      });
      (prisma.vendorProfile.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.getDispute('d-1', 'random-user')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('resolveDispute', () => {
    it('resolves open dispute and notifies buyer+vendor', async () => {
      (prisma.dispute.findUnique as jest.Mock).mockResolvedValue({
        id: 'd-1',
        status: DisputeStatus.OPEN,
        order: { referenceCode: 'ORD-1', buyerId: 'buyer-1' },
        vendor: { userId: 'vendor-user-1' },
      });
      (prisma.dispute.update as jest.Mock).mockResolvedValue({
        id: 'd-1',
        status: DisputeStatus.RESOLVED,
      });

      const result = await service.resolveDispute('d-1', 'admin-1', {
        status: DisputeStatus.RESOLVED,
        adminNotes: 'Refund issued',
      });

      expect(result.status).toBe(DisputeStatus.RESOLVED);
      expect(notificationsService.create).toHaveBeenCalledTimes(2);
    });

    it('throws when dispute not found', async () => {
      (prisma.dispute.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.resolveDispute('missing', 'admin-1', { adminNotes: 'x' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws when dispute is not OPEN', async () => {
      (prisma.dispute.findUnique as jest.Mock).mockResolvedValue({
        id: 'd-1',
        status: DisputeStatus.RESOLVED,
        order: { referenceCode: 'ORD-1', buyerId: 'buyer-1' },
        vendor: { userId: 'vendor-user-1' },
      });

      await expect(
        service.resolveDispute('d-1', 'admin-1', { adminNotes: 'x' }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
