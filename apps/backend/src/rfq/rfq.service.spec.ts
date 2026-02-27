import { NotificationType } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { RfqService } from './rfq.service';

describe('RfqService vendor matching', () => {
  let service: RfqService;

  const prisma = {
    vendorProfile: {
      findMany: jest.fn(),
    },
  } as unknown as PrismaService;

  const notificationsService = {
    create: jest.fn(),
    createNotification: jest.fn(),
  } as unknown as NotificationsService;

  beforeEach(() => {
    jest.clearAllMocks();
    (notificationsService.create as jest.Mock).mockResolvedValue({
      id: 'notification-1',
      userId: 'vendor-user-1',
      type: NotificationType.RFQ_CREATED,
      title: 'New RFQ available',
      message: 'Mock',
      isRead: false,
      metadata: null,
      createdAt: new Date('2026-02-27T00:00:00.000Z'),
      updatedAt: new Date('2026-02-27T00:00:00.000Z'),
    });

    service = new RfqService(prisma, notificationsService);
  });

  it('vendor with matching product in same city is included', async () => {
    prisma.vendorProfile.findMany.mockResolvedValueOnce([{ id: 'vendor-1' }]);

    const result = await (service as unknown as {
      findMatchingVendorIds: (city: string, productIds: string[]) => Promise<string[]>;
    }).findMatchingVendorIds('Hyderabad', ['product-1']);

    expect(result).toEqual(['vendor-1']);
    expect(prisma.vendorProfile.findMany).toHaveBeenCalledWith({
      where: {
        city: 'Hyderabad',
        isApproved: true,
        deletedAt: null,
        products: {
          some: {
            productId: {
              in: ['product-1'],
            },
          },
        },
      },
      select: {
        id: true,
      },
    });
  });

  it('vendor with matching product in different city is excluded', async () => {
    prisma.vendorProfile.findMany.mockResolvedValueOnce([]);

    const result = await (service as unknown as {
      findMatchingVendorIds: (city: string, productIds: string[]) => Promise<string[]>;
    }).findMatchingVendorIds('Hyderabad', ['product-1']);

    expect(result).toEqual([]);

    const queryArg = (prisma.vendorProfile.findMany as jest.Mock).mock.calls[0][0] as {
      where: {
        city: string;
      };
    };

    expect(queryArg.where.city).toBe('Hyderabad');
  });

  it('vendor with no matching products is excluded', async () => {
    prisma.vendorProfile.findMany.mockResolvedValueOnce([]);

    const result = await (service as unknown as {
      findMatchingVendorIds: (city: string, productIds: string[]) => Promise<string[]>;
    }).findMatchingVendorIds('Hyderabad', ['product-999']);

    expect(result).toEqual([]);

    const queryArg = (prisma.vendorProfile.findMany as jest.Mock).mock.calls[0][0] as {
      where: {
        products: {
          some: {
            productId: {
              in: string[];
            };
          };
        };
      };
    };

    expect(queryArg.where.products.some.productId.in).toEqual(['product-999']);
  });

  it('unapproved vendor is excluded from matching query', async () => {
    prisma.vendorProfile.findMany.mockResolvedValueOnce([]);

    await (service as unknown as {
      findMatchingVendorIds: (city: string, productIds: string[]) => Promise<string[]>;
    }).findMatchingVendorIds('Hyderabad', ['product-1']);

    const queryArg = (prisma.vendorProfile.findMany as jest.Mock).mock.calls[0][0] as {
      where: {
        isApproved: boolean;
      };
    };

    expect(queryArg.where.isApproved).toBe(true);
  });

  it('returns empty array when no vendors match', async () => {
    const result = await (service as unknown as {
      findMatchingVendorIds: (city: string, productIds: string[]) => Promise<string[]>;
    }).findMatchingVendorIds('Hyderabad', []);

    expect(result).toEqual([]);
    expect(prisma.vendorProfile.findMany).not.toHaveBeenCalled();
  });
});
