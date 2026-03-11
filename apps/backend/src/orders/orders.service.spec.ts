import {
  BadRequestException,
} from '@nestjs/common';
import {
  NotificationType,
  OrderStatus,
  UserRole,
} from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersService } from './orders.service';

describe('OrdersService', () => {
  let service: OrdersService;

  const prisma = {
    order: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    vendorProfile: {
      findUnique: jest.fn(),
    },
  } as unknown as jest.Mocked<PrismaService>;

  const notificationsService = {
    createNotification: jest.fn(),
  } as unknown as NotificationsService;

  const baseOrder = {
    id: 'order-1',
    rfqId: 'rfq-1',
    quoteId: 'quote-1',
    buyerId: 'buyer-1',
    vendorId: 'vendor-profile-1',
    totalAmount: '1200.00',
    status: OrderStatus.CONFIRMED,
    paymentMethod: null,
    confirmedAt: new Date('2026-02-27T08:00:00.000Z'),
    dispatchedAt: null,
    deliveredAt: null,
    cancelledAt: null,
    cancelReason: null,
    createdAt: new Date('2026-02-27T08:00:00.000Z'),
    updatedAt: new Date('2026-02-27T08:00:00.000Z'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new OrdersService(prisma, notificationsService);
    (notificationsService.createNotification as jest.Mock).mockResolvedValue(undefined);
  });

  describe('valid transitions', () => {
    it('CONFIRMED -> OUT_FOR_DELIVERY (vendor)', async () => {
      prisma.vendorProfile.findUnique.mockResolvedValueOnce({ id: 'vendor-profile-1' });
      prisma.order.findUnique.mockResolvedValueOnce({
        ...baseOrder,
        status: OrderStatus.CONFIRMED,
      });
      prisma.order.update.mockResolvedValueOnce({
        ...baseOrder,
        status: OrderStatus.OUT_FOR_DELIVERY,
        dispatchedAt: new Date('2026-02-27T09:00:00.000Z'),
      });

      const result = await service.updateOrderStatus('order-1', 'vendor-user-1', {
        status: OrderStatus.OUT_FOR_DELIVERY,
      });

      expect(result.status).toBe(OrderStatus.OUT_FOR_DELIVERY);
      expect(prisma.order.update).toHaveBeenCalledTimes(1);
      expect(notificationsService.createNotification).toHaveBeenCalledWith(
        'buyer-1',
        NotificationType.STATUS_UPDATED,
        'Order status updated',
        expect.stringContaining('out for delivery'),
        expect.objectContaining({ status: OrderStatus.OUT_FOR_DELIVERY }),
      );
    });

    it('OUT_FOR_DELIVERY -> DELIVERED (vendor)', async () => {
      prisma.vendorProfile.findUnique.mockResolvedValueOnce({ id: 'vendor-profile-1' });
      prisma.order.findUnique.mockResolvedValueOnce({
        ...baseOrder,
        status: OrderStatus.OUT_FOR_DELIVERY,
      });
      prisma.order.update.mockResolvedValueOnce({
        ...baseOrder,
        status: OrderStatus.DELIVERED,
        deliveredAt: new Date('2026-02-27T10:00:00.000Z'),
      });

      const result = await service.updateOrderStatus('order-1', 'vendor-user-1', {
        status: OrderStatus.DELIVERED,
      });

      expect(result.status).toBe(OrderStatus.DELIVERED);
      expect(notificationsService.createNotification).toHaveBeenCalledWith(
        'buyer-1',
        NotificationType.STATUS_UPDATED,
        'Order status updated',
        expect.stringContaining('delivered'),
        expect.objectContaining({ status: OrderStatus.DELIVERED }),
      );
    });

    it('CONFIRMED -> CANCELLED (buyer)', async () => {
      prisma.order.findUnique.mockResolvedValueOnce({
        ...baseOrder,
        status: OrderStatus.CONFIRMED,
      });
      prisma.order.update.mockResolvedValueOnce({
        ...baseOrder,
        status: OrderStatus.CANCELLED,
        cancelledAt: new Date('2026-02-27T09:30:00.000Z'),
        cancelReason: 'Buyer requested cancellation',
      });
      prisma.vendorProfile.findUnique.mockResolvedValueOnce({ userId: 'vendor-user-1' });

      const result = await service.cancelOrder(
        'order-1',
        'buyer-1',
        UserRole.BUYER,
        'Buyer requested cancellation',
      );

      expect(result.status).toBe(OrderStatus.CANCELLED);
      expect(prisma.order.update).toHaveBeenCalledWith({
        where: { id: 'order-1' },
        data: expect.objectContaining({
          status: OrderStatus.CANCELLED,
          cancelReason: 'Buyer requested cancellation',
          cancelledAt: expect.any(Date),
        }),
      });
      expect(notificationsService.createNotification).toHaveBeenCalledTimes(2);
    });
  });

  describe('invalid transitions', () => {
    it.each([
      [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
      [OrderStatus.CANCELLED, OrderStatus.CONFIRMED],
      [OrderStatus.OUT_FOR_DELIVERY, OrderStatus.CONFIRMED],
      [OrderStatus.DELIVERED, OrderStatus.OUT_FOR_DELIVERY],
    ])(
      'throws BadRequestException for %s -> %s',
      async (currentStatus: OrderStatus, requestedStatus: OrderStatus) => {
        prisma.vendorProfile.findUnique.mockResolvedValueOnce({ id: 'vendor-profile-1' });
        prisma.order.findUnique.mockResolvedValueOnce({
          ...baseOrder,
          status: currentStatus,
        });

        await expect(
          service.updateOrderStatus('order-1', 'vendor-user-1', {
            status: requestedStatus,
          }),
        ).rejects.toBeInstanceOf(BadRequestException);

        expect(prisma.order.update).not.toHaveBeenCalled();
      },
    );
  });
});
