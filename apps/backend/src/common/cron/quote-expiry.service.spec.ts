import { NotificationType } from '@prisma/client';
import type { NotificationsService } from '../../notifications/notifications.service';
import type { PrismaService } from '../../prisma/prisma.service';
import { QuoteExpiryService } from './quote-expiry.service';

describe('QuoteExpiryService', () => {
  let service: QuoteExpiryService;

  const prisma = {
    quote: {
      updateMany: jest.fn(),
    },
    rFQ: {
      findMany: jest.fn(),
    },
  } as unknown as jest.Mocked<PrismaService>;

  const notificationsService = {
    create: jest.fn(),
  } as unknown as jest.Mocked<NotificationsService>;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new QuoteExpiryService(prisma, notificationsService);
  });

  it('marks overdue quotes as withdrawn', async () => {
    (prisma.quote.updateMany as jest.Mock).mockResolvedValue({ count: 3 });

    await service.expireOverdueQuotes();

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(prisma.quote.updateMany).toHaveBeenCalledWith({
      where: {
        isWithdrawn: false,
        validUntil: { lt: expect.any(Date) },
      },
      data: {
        isWithdrawn: true,
      },
    });
  });

  it('swallows updateMany errors in expireOverdueQuotes', async () => {
    (prisma.quote.updateMany as jest.Mock).mockRejectedValue(new Error('db unavailable'));

    await expect(service.expireOverdueQuotes()).resolves.toBeUndefined();
  });

  it('returns early when no RFQs are expiring soon', async () => {
    (prisma.rFQ.findMany as jest.Mock).mockResolvedValue([]);

    await service.notifyExpiringRfqs();

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(notificationsService.create).not.toHaveBeenCalled();
  });

  it('creates notifications for each expiring RFQ', async () => {
    (prisma.rFQ.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'rfq-1',
        buyerId: 'buyer-1',
        title: 'Cement',
        referenceCode: 'RFQ-001',
      },
      {
        id: 'rfq-2',
        buyerId: 'buyer-2',
        title: null,
        referenceCode: 'RFQ-002',
      },
    ]);
    (notificationsService.create as jest.Mock).mockResolvedValue(undefined);

    await service.notifyExpiringRfqs();

    expect(notificationsService.create).toHaveBeenCalledTimes(2);
    expect(notificationsService.create).toHaveBeenNthCalledWith(1, {
      userId: 'buyer-1',
      type: NotificationType.RFQ_EXPIRING_SOON,
      title: 'RFQ Expiring Soon',
      message: 'Your RFQ "Cement" expires in less than 24 hours',
      metadata: { rfqId: 'rfq-1' },
    });
    expect(notificationsService.create).toHaveBeenNthCalledWith(2, {
      userId: 'buyer-2',
      type: NotificationType.RFQ_EXPIRING_SOON,
      title: 'RFQ Expiring Soon',
      message: 'Your RFQ "RFQ-002" expires in less than 24 hours',
      metadata: { rfqId: 'rfq-2' },
    });
  });

  it('swallows findMany errors in notifyExpiringRfqs', async () => {
    (prisma.rFQ.findMany as jest.Mock).mockRejectedValue(new Error('db unavailable'));

    await expect(service.notifyExpiringRfqs()).resolves.toBeUndefined();
  });
});
