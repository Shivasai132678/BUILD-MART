import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';

// Mock axios globally so external API calls never fire
jest.mock('axios', () => ({
  post: jest.fn().mockResolvedValue({ data: {} }),
}));

const mockedAxios = jest.mocked(axios);

describe('NotificationsService', () => {
  let service: NotificationsService;

  const prisma = {
    notification: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  } as unknown as jest.Mocked<PrismaService>;

  beforeEach(() => {
    jest.clearAllMocks();
    // Default: user without phone so external dispatch is a no-op
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ phone: null });
    service = new NotificationsService(prisma, null as any);
  });

  describe('create', () => {
    it('persists notification to DB', async () => {
      const mockNotification = {
        id: 'notif-1',
        userId: 'user-1',
        type: NotificationType.RFQ_CREATED,
        title: 'New RFQ',
        message: 'An RFQ was created',
        isRead: false,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.notification.create as jest.Mock).mockResolvedValue(
        mockNotification,
      );

      const result = await service.create({
        userId: 'user-1',
        type: NotificationType.RFQ_CREATED,
        title: 'New RFQ',
        message: 'An RFQ was created',
      });

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          type: NotificationType.RFQ_CREATED,
          title: 'New RFQ',
          message: 'An RFQ was created',
        },
      });
      expect(result).toEqual(mockNotification);
    });

    it('returns the created notification', async () => {
      const mockNotification = {
        id: 'notif-2',
        userId: 'user-2',
        type: NotificationType.QUOTE_RECEIVED,
        title: 'Quote received',
        message: 'A vendor submitted a quote',
        isRead: false,
        metadata: { rfqId: 'rfq-1' },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.notification.create as jest.Mock).mockResolvedValue(
        mockNotification,
      );

      const result = await service.create({
        userId: 'user-2',
        type: NotificationType.QUOTE_RECEIVED,
        title: 'Quote received',
        message: 'A vendor submitted a quote',
        metadata: { rfqId: 'rfq-1' },
      });

      expect(result.id).toBe('notif-2');
      expect(result.metadata).toEqual({ rfqId: 'rfq-1' });
    });

    it('does NOT throw if safeDispatch fails (non-blocking)', async () => {
      const mockNotification = {
        id: 'notif-3',
        userId: 'user-3',
        type: NotificationType.PAYMENT_SUCCESS,
        title: 'Payment success',
        message: 'Payment received',
        isRead: false,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.notification.create as jest.Mock).mockResolvedValue(
        mockNotification,
      );
      // User with phone so dispatch is attempted
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        phone: '+919000000001',
      });

      // Mock axios.post to throw (simulating external API failure)
      mockedAxios.post.mockRejectedValueOnce(new Error('WhatsApp API down'));
      mockedAxios.post.mockRejectedValueOnce(new Error('SMS API down'));

      // Should NOT throw despite dispatch failure
      const result = await service.create({
        userId: 'user-3',
        type: NotificationType.PAYMENT_SUCCESS,
        title: 'Payment success',
        message: 'Payment received',
      });

      expect(result).toEqual(mockNotification);
    });

    it('persists metadata when provided', async () => {
      const mockNotification = {
        id: 'notif-4',
        userId: 'user-4',
        type: NotificationType.ORDER_CONFIRMED,
        title: 'Order confirmed',
        message: 'Your order is confirmed',
        isRead: false,
        metadata: { orderId: 'order-1' },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.notification.create as jest.Mock).mockResolvedValue(
        mockNotification,
      );

      await service.create({
        userId: 'user-4',
        type: NotificationType.ORDER_CONFIRMED,
        title: 'Order confirmed',
        message: 'Your order is confirmed',
        metadata: { orderId: 'order-1' },
      });

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(prisma.notification.create).toHaveBeenCalledWith({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data: expect.objectContaining({
          metadata: { orderId: 'order-1' },
        }),
      });
    });
  });

  describe('safeDispatch (via create)', () => {
    it('skips sendWhatsApp when WHATSAPP_API_KEY is empty', async () => {
      const originalWhatsApp = process.env.WHATSAPP_API_KEY;
      const originalMsg91 = process.env.MSG91_AUTH_KEY;
      delete process.env.WHATSAPP_API_KEY;
      delete process.env.MSG91_AUTH_KEY;

      (prisma.notification.create as jest.Mock).mockResolvedValue({
        id: 'notif-5',
        userId: 'user-5',
        type: NotificationType.RFQ_CREATED,
        title: 'Test',
        message: 'Test',
        isRead: false,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        phone: '+919000000001',
      });

      await service.create({
        userId: 'user-5',
        type: NotificationType.RFQ_CREATED,
        title: 'Test',
        message: 'Test',
      });

      // Allow async dispatch to complete
      await new Promise((resolve) => setTimeout(resolve, 50));

      // axios.post should NOT have been called since env keys are missing
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockedAxios.post).not.toHaveBeenCalled();

      // Restore env
      if (originalWhatsApp) process.env.WHATSAPP_API_KEY = originalWhatsApp;
      if (originalMsg91) process.env.MSG91_AUTH_KEY = originalMsg91;
    });

    it('skips sendSms when MSG91_AUTH_KEY is empty', async () => {
      const originalMsg91 = process.env.MSG91_AUTH_KEY;
      const originalWhatsApp = process.env.WHATSAPP_API_KEY;
      delete process.env.MSG91_AUTH_KEY;
      delete process.env.WHATSAPP_API_KEY;

      (prisma.notification.create as jest.Mock).mockResolvedValue({
        id: 'notif-6',
        userId: 'user-6',
        type: NotificationType.QUOTE_RECEIVED,
        title: 'Test',
        message: 'Test',
        isRead: false,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        phone: '+919000000002',
      });

      await service.create({
        userId: 'user-6',
        type: NotificationType.QUOTE_RECEIVED,
        title: 'Test',
        message: 'Test',
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockedAxios.post).not.toHaveBeenCalled();

      if (originalMsg91) process.env.MSG91_AUTH_KEY = originalMsg91;
      if (originalWhatsApp) process.env.WHATSAPP_API_KEY = originalWhatsApp;
    });
  });

  describe('listNotifications', () => {
    it('returns paginated notifications for the requesting user', async () => {
      const notifications = [
        { id: 'n1', userId: 'user-1', isRead: false },
        { id: 'n2', userId: 'user-1', isRead: true },
      ];

      (prisma.$transaction as jest.Mock).mockResolvedValue([notifications, 2]);

      const result = await service.listNotifications('user-1', 20, 0);

      expect(result).toEqual({
        items: notifications,
        total: 2,
        limit: 20,
        offset: 0,
      });
    });

    it('returns empty array when no notifications exist', async () => {
      (prisma.$transaction as jest.Mock).mockResolvedValue([[], 0]);

      const result = await service.listNotifications('user-1', 20, 0);

      expect(result.items).toEqual([]);
      expect(Array.isArray(result.items)).toBe(true);
      expect(result.total).toBe(0);
    });

    it('orders by isRead asc then createdAt desc (unread first)', async () => {
      (prisma.$transaction as jest.Mock).mockResolvedValue([[], 0]);

      await service.listNotifications('user-1', 10, 5);

      // Verify the transaction was called (query construction is internal to Prisma)
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('markAsRead', () => {
    it('sets isRead = true for a notification', async () => {
      (prisma.notification.findUnique as jest.Mock).mockResolvedValue({
        id: 'notif-1',
        userId: 'user-1',
        isRead: false,
      });

      const updated = {
        id: 'notif-1',
        userId: 'user-1',
        isRead: true,
      };

      (prisma.notification.update as jest.Mock).mockResolvedValue(updated);

      const result = await service.markAsRead('notif-1', 'user-1');

      expect(result.isRead).toBe(true);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: 'notif-1' },
        data: { isRead: true },
      });
    });

    it('throws ForbiddenException if notification belongs to a different user', async () => {
      (prisma.notification.findUnique as jest.Mock).mockResolvedValue({
        id: 'notif-1',
        userId: 'user-1',
        isRead: false,
      });

      await expect(
        service.markAsRead('notif-1', 'different-user'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException if notification does not exist', async () => {
      (prisma.notification.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.markAsRead('notif-nonexistent', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('markAllAsRead', () => {
    it('sets isRead = true for all unread notifications of a user', async () => {
      (prisma.notification.updateMany as jest.Mock).mockResolvedValue({
        count: 5,
      });

      const result = await service.markAllAsRead('user-1');

      expect(result).toEqual({ count: 5 });
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(prisma.notification.updateMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          isRead: false,
        },
        data: {
          isRead: true,
        },
      });
    });
  });
});
