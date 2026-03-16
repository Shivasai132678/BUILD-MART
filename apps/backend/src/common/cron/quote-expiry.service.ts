import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationType } from '@prisma/client';
import { NotificationsService } from '../../notifications/notifications.service';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class QuoteExpiryService {
  private readonly logger = new Logger(QuoteExpiryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Runs every 10 minutes.
   * Marks quotes as withdrawn if validUntil has passed and they haven't
   * already been withdrawn.
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async expireOverdueQuotes(): Promise<void> {
    const now = new Date();

    try {
      const result = await this.prisma.quote.updateMany({
        where: {
          isWithdrawn: false,
          validUntil: { lt: now },
        },
        data: {
          isWithdrawn: true,
        },
      });

      if (result.count > 0) {
        this.logger.log(`Quote expiry cron: withdrew ${result.count} expired quote(s)`);
      }
    } catch (error: unknown) {
      this.logger.error(
        'Quote expiry cron failed',
        error instanceof Error ? error.stack : error,
      );
    }
  }

  /**
   * Runs daily at 8:00 AM UTC.
   * Notifies buyers if their RFQ is expiring within 24 hours.
   */
  @Cron('0 8 * * *')
  async notifyExpiringRfqs(): Promise<void> {
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    try {
      const expiringRfqs = await this.prisma.rFQ.findMany({
        where: {
          status: { in: ['OPEN', 'QUOTED'] },
          validUntil: { gte: now, lte: in24h },
        },
        select: {
          id: true,
          referenceCode: true,
          buyerId: true,
          title: true,
        },
      });

      if (expiringRfqs.length === 0) return;

      this.logger.log(`RFQ expiry warning: notifying for ${expiringRfqs.length} RFQ(s)`);

      await Promise.allSettled(
        expiringRfqs.map((rfq) =>
          this.notificationsService.create({
            userId: rfq.buyerId,
            type: NotificationType.RFQ_EXPIRING_SOON,
            title: 'RFQ Expiring Soon',
            message: `Your RFQ "${rfq.title ?? rfq.referenceCode ?? rfq.id}" expires in less than 24 hours`,
            metadata: { rfqId: rfq.id },
          }),
        ),
      );
    } catch (error: unknown) {
      this.logger.error(
        'RFQ expiry warning cron failed',
        error instanceof Error ? error.stack : error,
      );
    }
  }
}
