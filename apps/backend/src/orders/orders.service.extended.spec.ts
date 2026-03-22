import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  NotificationType,
  OrderStatus,
  Prisma,
  RFQStatus,
  UserRole,
  VendorStatus,
} from '@prisma/client';
import type { NotificationsService } from '../notifications/notifications.service';
import type { PrismaService } from '../prisma/prisma.service';
import { OrdersService } from './orders.service';

const decimal = (value: string) => new Prisma.Decimal(value);

describe('OrdersService (extended coverage)', () => {
  let service: OrdersService;

  const prisma = {
    quote: {
      findUnique: jest.fn(),
    },
    order: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    rFQ: {
      update: jest.fn(),
    },
    vendorProfile: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    address: {
      findUnique: jest.fn(),
    },
    vendorProduct: {
      findMany: jest.fn(),
    },
    review: {
      create: jest.fn(),
      aggregate: jest.fn(),
    },
    $transaction: jest.fn(),
  } as unknown as jest.Mocked<PrismaService>;

  const notificationsService = {
    create: jest.fn(),
  } as unknown as jest.Mocked<NotificationsService>;

  const baseQuote = {
    id: 'quote-1',
    rfqId: 'rfq-1',
    vendorId: 'vendor-profile-1',
    totalAmount: decimal('1000.00'),
    validUntil: new Date('2030-01-01T00:00:00.000Z'),
    isWithdrawn: false,
    rfq: {
      id: 'rfq-1',
      buyerId: 'buyer-1',
      status: RFQStatus.OPEN,
    },
  };

  beforeEach(() => {
    jest.resetAllMocks();
    service = new OrdersService(prisma, notificationsService);
    (notificationsService.create as jest.Mock).mockResolvedValue(undefined);
  });

  describe('createOrder', () => {
    it('throws when quote does not exist', async () => {
      (prisma.quote.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.createOrder('buyer-1', { quoteId: 'missing' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('throws when quote belongs to another buyer', async () => {
      (prisma.quote.findUnique as jest.Mock).mockResolvedValue({
        ...baseQuote,
        rfq: { ...baseQuote.rfq, buyerId: 'buyer-2' },
      });

      await expect(service.createOrder('buyer-1', { quoteId: 'quote-1' })).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('throws when quote is expired', async () => {
      (prisma.quote.findUnique as jest.Mock).mockResolvedValue({
        ...baseQuote,
        validUntil: new Date('2020-01-01T00:00:00.000Z'),
      });

      await expect(service.createOrder('buyer-1', { quoteId: 'quote-1' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('throws when quote is withdrawn', async () => {
      (prisma.quote.findUnique as jest.Mock).mockResolvedValue({ ...baseQuote, isWithdrawn: true });

      await expect(service.createOrder('buyer-1', { quoteId: 'quote-1' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('throws when rfq status is neither OPEN nor QUOTED', async () => {
      (prisma.quote.findUnique as jest.Mock).mockResolvedValue({
        ...baseQuote,
        rfq: { ...baseQuote.rfq, status: RFQStatus.CLOSED },
      });

      await expect(service.createOrder('buyer-1', { quoteId: 'quote-1' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('throws conflict when order already exists for rfq', async () => {
      (prisma.quote.findUnique as jest.Mock).mockResolvedValue(baseQuote);
      (prisma.order.findUnique as jest.Mock).mockResolvedValue({ id: 'order-1' });

      await expect(service.createOrder('buyer-1', { quoteId: 'quote-1' })).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('creates order successfully and sends buyer notification', async () => {
      (prisma.quote.findUnique as jest.Mock).mockResolvedValue(baseQuote);
      (prisma.order.findUnique as jest.Mock).mockResolvedValue(null);

      (prisma.$transaction as jest.Mock).mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          $executeRaw: jest.fn().mockResolvedValue(undefined),
          $queryRaw: jest.fn().mockResolvedValue([{ referenceCode: 'ORD-00001' }]),
          order: {
            create: jest.fn().mockResolvedValue({
              id: 'order-1',
              referenceCode: 'ORD-00001',
              buyerId: 'buyer-1',
              vendorId: 'vendor-profile-1',
            }),
          },
          rFQ: {
            update: jest.fn().mockResolvedValue({ id: 'rfq-1', status: RFQStatus.CLOSED }),
          },
        };

        return fn(tx);
      });

      const result = await service.createOrder('buyer-1', { quoteId: 'quote-1' });

      expect(result.id).toBe('order-1');
      expect(notificationsService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'buyer-1',
          type: NotificationType.ORDER_CONFIRMED,
          metadata: expect.objectContaining({ rfqId: 'rfq-1', orderId: 'order-1' }),
        }),
      );
    });

    it('does not fail createOrder when notification fails', async () => {
      (prisma.quote.findUnique as jest.Mock).mockResolvedValue(baseQuote);
      (prisma.order.findUnique as jest.Mock).mockResolvedValue(null);
      (notificationsService.create as jest.Mock).mockRejectedValue(new Error('notification down'));

      (prisma.$transaction as jest.Mock).mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          $executeRaw: jest.fn().mockResolvedValue(undefined),
          $queryRaw: jest.fn().mockResolvedValue([{ referenceCode: 'ORD-00001' }]),
          order: {
            create: jest.fn().mockResolvedValue({
              id: 'order-1',
              referenceCode: 'ORD-00001',
              buyerId: 'buyer-1',
              vendorId: 'vendor-profile-1',
            }),
          },
          rFQ: {
            update: jest.fn().mockResolvedValue({ id: 'rfq-1', status: RFQStatus.CLOSED }),
          },
        };

        return fn(tx);
      });

      await expect(service.createOrder('buyer-1', { quoteId: 'quote-1' })).resolves.toEqual(
        expect.objectContaining({ id: 'order-1' }),
      );
    });

    it('retries on referenceCode collision and then succeeds', async () => {
      (prisma.quote.findUnique as jest.Mock).mockResolvedValue(baseQuote);
      (prisma.order.findUnique as jest.Mock).mockResolvedValue(null);

      const p2002Reference = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        {
          code: 'P2002',
          clientVersion: '6.0.0',
          meta: { target: ['referenceCode'] },
        },
      );

      (prisma.$transaction as jest.Mock)
        .mockRejectedValueOnce(p2002Reference)
        .mockImplementationOnce(async (fn: (tx: unknown) => Promise<unknown>) => {
          const tx = {
            $executeRaw: jest.fn().mockResolvedValue(undefined),
            $queryRaw: jest.fn().mockResolvedValue([{ referenceCode: 'ORD-00002' }]),
            order: {
              create: jest.fn().mockResolvedValue({
                id: 'order-2',
                referenceCode: 'ORD-00002',
                buyerId: 'buyer-1',
                vendorId: 'vendor-profile-1',
              }),
            },
            rFQ: {
              update: jest.fn().mockResolvedValue({ id: 'rfq-1', status: RFQStatus.CLOSED }),
            },
          };

          return fn(tx);
        });

      const result = await service.createOrder('buyer-1', { quoteId: 'quote-1' });
      expect(result.id).toBe('order-2');
      expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    });
  });

  describe('createDirectOrder', () => {
    const directDto = {
      vendorId: 'vendor-profile-1',
      addressId: 'addr-1',
      items: [{ productId: 'prod-1', quantity: '2' }],
    };

    it('throws when vendor is not approved', async () => {
      (prisma.vendorProfile.findUnique as jest.Mock).mockResolvedValue({
        id: 'vendor-profile-1',
        status: VendorStatus.SUSPENDED,
        userId: 'vendor-user-1',
      });

      await expect(service.createDirectOrder('buyer-1', directDto)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('throws when buyer tries ordering from self', async () => {
      (prisma.vendorProfile.findUnique as jest.Mock).mockResolvedValue({
        id: 'vendor-profile-1',
        status: VendorStatus.APPROVED,
        userId: 'buyer-1',
      });

      await expect(service.createDirectOrder('buyer-1', directDto)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('throws when delivery address does not belong to buyer', async () => {
      (prisma.vendorProfile.findUnique as jest.Mock).mockResolvedValue({
        id: 'vendor-profile-1',
        status: VendorStatus.APPROVED,
        userId: 'vendor-user-1',
      });
      (prisma.address.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.createDirectOrder('buyer-1', directDto)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('throws when one of the requested products is unavailable', async () => {
      (prisma.vendorProfile.findUnique as jest.Mock).mockResolvedValue({
        id: 'vendor-profile-1',
        status: VendorStatus.APPROVED,
        userId: 'vendor-user-1',
      });
      (prisma.address.findUnique as jest.Mock).mockResolvedValue({ id: 'addr-1', userId: 'buyer-1' });
      (prisma.vendorProduct.findMany as jest.Mock).mockResolvedValue([]);

      await expect(service.createDirectOrder('buyer-1', directDto)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('creates direct order and sends notification', async () => {
      (prisma.vendorProfile.findUnique as jest.Mock).mockResolvedValue({
        id: 'vendor-profile-1',
        status: VendorStatus.APPROVED,
        userId: 'vendor-user-1',
      });
      (prisma.address.findUnique as jest.Mock).mockResolvedValue({ id: 'addr-1', userId: 'buyer-1' });
      (prisma.vendorProduct.findMany as jest.Mock).mockResolvedValue([
        {
          productId: 'prod-1',
          customPrice: null,
          product: {
            id: 'prod-1',
            name: 'Cement',
            unit: 'bag',
            basePrice: decimal('100.00'),
            isActive: true,
            deletedAt: null,
          },
        },
      ]);

      (prisma.$transaction as jest.Mock).mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          $executeRaw: jest.fn().mockResolvedValue(undefined),
          $queryRaw: jest.fn().mockResolvedValue([{ referenceCode: 'ORD-10001' }]),
          order: {
            create: jest.fn().mockResolvedValue({
              id: 'order-direct-1',
              referenceCode: 'ORD-10001',
              buyerId: 'buyer-1',
              vendorId: 'vendor-profile-1',
              totalAmount: decimal('200.00'),
            }),
          },
        };
        return fn(tx);
      });

      const result = await service.createDirectOrder('buyer-1', directDto);

      expect(result.id).toBe('order-direct-1');
      expect(notificationsService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'buyer-1',
          type: NotificationType.ORDER_CONFIRMED,
        }),
      );
    });
  });

  describe('list/get/cancel/review flows', () => {
    it('lists orders for buyer role', async () => {
      (prisma.order.findMany as jest.Mock).mockResolvedValue([{ id: 'order-1' }]);
      (prisma.order.count as jest.Mock).mockResolvedValue(1);

      (prisma.$transaction as jest.Mock).mockImplementation(async (arg: unknown) => {
        if (Array.isArray(arg)) {
          return Promise.all(arg);
        }
        return null;
      });

      const result = await service.listOrders('buyer-1', UserRole.BUYER, 20, 0, undefined);

      expect(result.total).toBe(1);
      expect(result.items).toEqual([{ id: 'order-1' }]);
    });

    it('gets order for buyer and throws not found when inaccessible', async () => {
      (prisma.order.findFirst as jest.Mock).mockResolvedValue({ id: 'order-1' });
      await expect(service.getOrder('order-1', 'buyer-1', UserRole.BUYER)).resolves.toEqual({
        id: 'order-1',
      });

      (prisma.order.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(service.getOrder('order-2', 'buyer-1', UserRole.BUYER)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('throws forbidden for unsupported role in listOrders', async () => {
      await expect(
        service.listOrders('admin-1', UserRole.ADMIN, 20, 0, undefined),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('cancels order for vendor role when owner matches', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue({
        id: 'order-1',
        buyerId: 'buyer-1',
        vendorId: 'vendor-profile-1',
        status: OrderStatus.CONFIRMED,
        referenceCode: 'ORD-1',
      });
      (prisma.vendorProfile.findUnique as jest.Mock).mockResolvedValue({
        id: 'vendor-profile-1',
        userId: 'vendor-user-1',
      });
      (prisma.order.update as jest.Mock).mockResolvedValue({
        id: 'order-1',
        status: OrderStatus.CANCELLED,
        referenceCode: 'ORD-1',
      });

      const result = await service.cancelOrder('order-1', 'vendor-user-1', UserRole.VENDOR, 'stock issue');
      expect(result.status).toBe(OrderStatus.CANCELLED);
    });

    it('submits review and updates vendor aggregates', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue({
        id: 'order-1',
        buyerId: 'buyer-1',
        vendorId: 'vendor-profile-1',
        status: OrderStatus.DELIVERED,
        review: null,
      });

      (prisma.$transaction as jest.Mock).mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          review: {
            create: jest.fn().mockResolvedValue({ id: 'review-1', rating: 5 }),
            aggregate: jest
              .fn()
              .mockResolvedValue({ _avg: { rating: 4.7 }, _count: { id: 17 } }),
          },
          vendorProfile: {
            update: jest.fn().mockResolvedValue({ id: 'vendor-profile-1' }),
          },
        };

        return fn(tx);
      });

      const result = await service.submitReview('order-1', 'buyer-1', { rating: 5, comment: 'great' });
      expect(result).toEqual({ id: 'review-1', rating: 5 });
    });
  });
});
