import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Notification, NotificationType, Prisma } from '@prisma/client';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';

type PaginatedNotifications = {
  items: Notification[];
  total: number;
  limit: number;
  offset: number;
};

type CreateNotificationInput = {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  metadata?: Prisma.InputJsonValue;
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateNotificationInput): Promise<Notification> {
    const { userId, type, title, message, metadata } = input;

    const notification = await this.prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        ...(metadata !== undefined ? { metadata } : {}),
      },
    });

    this.logger.log(
      `Notification created — id: ${notification.id}, ` +
        `type: ${type}, userId: ${userId}`,
    );

    this.safeDispatch(userId, notification.id, type, message).catch(() => {
      /* already logged inside safeDispatch */
    });

    return notification;
  }

  async createNotification(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    metadata?: Prisma.InputJsonValue,
  ): Promise<Notification> {
    return this.create({
      userId,
      type,
      title,
      message,
      ...(metadata !== undefined ? { metadata } : {}),
    });
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
      throw new ForbiddenException(
        'You are not allowed to modify this notification',
      );
    }

    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  }

  async getUnreadCount(userId: string): Promise<{ count: number }> {
    const count = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });
    return { count };
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

    this.logger.log(
      `Notifications marked read count=${result.count} userId=${userId}`,
    );

    return { count: result.count };
  }

  private async safeDispatch(
    userId: string,
    notificationId: string,
    type: NotificationType,
    message: string,
  ): Promise<void> {
    try {
      await this.dispatchExternalNotifications(userId, type, message);
    } catch (err) {
      this.logger.error(
        `External notification dispatch failed — ` +
          `notificationId: ${notificationId}, ` +
          `userId: ${userId}, ` +
          `error: ${err instanceof Error ? err.message : 'Unknown error'}`,
      );
      // Do NOT re-throw — notification failure must never
      // block the main operation (Rule 15)
    }
  }

  private async dispatchExternalNotifications(
    userId: string,
    type: NotificationType,
    message: string,
  ): Promise<void> {
    if (!this.shouldSendExternalNotifications(type)) {
      return;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { phone: true },
    });

    if (!user?.phone) {
      this.logger.warn(
        `User phone missing for external notification userId=${userId} type=${type}`,
      );
      return;
    }

    await Promise.allSettled([
      this.sendWhatsApp(user.phone, message),
      this.sendSms(user.phone, message),
    ]);
  }

  private shouldSendExternalNotifications(type: NotificationType): boolean {
    const externalTypes = new Set<NotificationType>([
      NotificationType.RFQ_CREATED,
      NotificationType.QUOTE_RECEIVED,
      NotificationType.ORDER_CONFIRMED,
      NotificationType.STATUS_UPDATED,
      NotificationType.PAYMENT_INITIATED,
      NotificationType.PAYMENT_SUCCESS,
      NotificationType.PAYMENT_FAILED,
    ]);
    return externalTypes.has(type);
  }

  private async sendWhatsApp(phone: string, message: string): Promise<void> {
    const apiKey = process.env.WHATSAPP_API_KEY;
    if (!apiKey) {
      this.logger.warn(
        'WHATSAPP_API_KEY not set — WhatsApp notification skipped',
      );
      return;
    }
    try {
      await axios.post(
        'https://api.interakt.ai/v1/public/message/',
        {
          countryCode: '+91',
          phoneNumber: phone,
          callbackData: 'notification',
          type: 'Text',
          data: { message },
        },
        {
          headers: { Authorization: `Basic ${apiKey}` },
        },
      );
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown WhatsApp error';
      this.logger.error(`WhatsApp send failed for ${phone}: ${errorMessage}`);
    }
  }

  private async sendSms(phone: string, message: string): Promise<void> {
    const authKey = process.env.MSG91_AUTH_KEY;
    if (!authKey) {
      this.logger.warn('MSG91_AUTH_KEY not set — SMS notification skipped');
      return;
    }

    const templateId = process.env.MSG91_TEMPLATE_ID;
    if (!templateId) {
      this.logger.warn('MSG91_TEMPLATE_ID not set — SMS notification skipped');
      return;
    }

    try {
      await axios.post(
        'https://control.msg91.com/api/v5/flow/',
        {
          template_id: templateId,
          recipients: [{ mobiles: phone.replace('+', ''), message }],
        },
        {
          headers: { authkey: authKey },
        },
      );
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown SMS error';
      this.logger.error(`SMS send failed for ${phone}: ${errorMessage}`);
    }
  }
}
