import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Notification, NotificationType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type PaginatedNotifications = {
  items: Notification[];
  total: number;
  limit: number;
  offset: number;
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createNotification(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    metadata?: Prisma.InputJsonValue,
  ): Promise<Notification> {
    const notification = await this.prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        ...(metadata !== undefined ? { metadata } : {}),
      },
    });

    this.logger.log(`Notification created id=${notification.id} userId=${userId} type=${type}`);

    // TODO: send SMS via MSG91 — see ENV.md for MSG91_AUTH_KEY
    // TODO: send WhatsApp via Interakt/AiSensy — see ENV.md for WHATSAPP_API_KEY

    return notification;
  }

  async listNotifications(
    userId: string,
    limit: number,
    offset: number,
  ): Promise<PaginatedNotifications> {
    const where: Prisma.NotificationWhereInput = { userId };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: [{ isRead: 'asc' }, { createdAt: 'desc' }],
      }),
      this.prisma.notification.count({ where }),
    ]);

    return { items, total, limit, offset };
  }

  async markAsRead(id: string, userId: string): Promise<Notification> {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    if (notification.userId !== userId) {
      throw new ForbiddenException('You are not allowed to modify this notification');
    }

    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  }

  async markAllAsRead(userId: string): Promise<{ count: number }> {
    const result = await this.prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
      },
    });

    this.logger.log(`Notifications marked read count=${result.count} userId=${userId}`);

    return { count: result.count };
  }
}
