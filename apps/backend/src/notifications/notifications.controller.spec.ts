import { UnauthorizedException } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import type { NotificationsService } from './notifications.service';

describe('NotificationsController', () => {
  const notificationsService = {
    getUnreadCount: jest.fn(),
    listNotifications: jest.fn(),
    markAllAsRead: jest.fn(),
    markAsRead: jest.fn(),
  } as unknown as jest.Mocked<NotificationsService>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delegates notification routes to service for authenticated user', async () => {
    const controller = new NotificationsController(notificationsService);
    const req = { user: { sub: 'user-1' } } as const;

    (notificationsService.getUnreadCount as jest.Mock).mockResolvedValue({ count: 3 });
    (notificationsService.listNotifications as jest.Mock).mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0 });
    (notificationsService.markAllAsRead as jest.Mock).mockResolvedValue({ updated: 3 });
    (notificationsService.markAsRead as jest.Mock).mockResolvedValue({ id: 'n1', isRead: true });

    await expect(controller.getUnreadCount(req)).resolves.toEqual({ count: 3 });
    await expect(controller.listNotifications(req, 20, 0)).resolves.toEqual({
      items: [],
      total: 0,
      limit: 20,
      offset: 0,
    });
    await expect(controller.markAllAsRead(req)).resolves.toEqual({ updated: 3 });
    await expect(controller.markAsRead('n1', req)).resolves.toEqual({ id: 'n1', isRead: true });
  });

  it('throws UnauthorizedException when user context is missing', async () => {
    const controller = new NotificationsController(notificationsService);

    expect(() => controller.getUnreadCount({} as never)).toThrow(UnauthorizedException);
  });
});
