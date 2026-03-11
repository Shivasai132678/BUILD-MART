import { NotFoundException } from '@nestjs/common';
import { NotificationType, RFQStatus, UserRole, VendorStatus } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { RfqService } from './rfq.service';

describe('RfqService vendor matching', () => {
  let service: RfqService;

  const prisma = {
    vendorProfile: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    rFQ: {
      findFirst: jest.fn(),
    },
  } as unknown as jest.Mocked<PrismaService>;

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
        status: VendorStatus.APPROVED,
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
        status: string;
      };
    };

    expect(queryArg.where.status).toBe(VendorStatus.APPROVED);
  });

  it('returns empty array when no vendors match', async () => {
    const result = await (service as unknown as {
      findMatchingVendorIds: (city: string, productIds: string[]) => Promise<string[]>;
    }).findMatchingVendorIds('Hyderabad', []);

    expect(result).toEqual([]);
    expect(prisma.vendorProfile.findMany).not.toHaveBeenCalled();
  });
});

describe('RfqService getRFQ vendor restriction', () => {
  let service: RfqService;

  const prisma = {
    vendorProfile: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    rFQ: {
      findFirst: jest.fn(),
    },
  } as unknown as jest.Mocked<PrismaService>;

  const notificationsService = {
    create: jest.fn(),
    createNotification: jest.fn(),
  } as unknown as NotificationsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new RfqService(prisma, notificationsService);
  });

  it('vendor with a valid profile can see any open RFQ', async () => {
    prisma.vendorProfile.findUnique.mockResolvedValueOnce({
      id: 'vp-1',
    });

    const mockRfq = {
      id: 'rfq-1',
      status: RFQStatus.OPEN,
      items: [{ id: 'item-1', productId: 'product-999' }],
    };
    prisma.rFQ.findFirst.mockResolvedValueOnce(mockRfq);

    const result = await service.getRFQ('rfq-1', 'vendor-user-1', UserRole.VENDOR);

    expect(result).toEqual(mockRfq);
    expect(prisma.vendorProfile.findUnique).toHaveBeenCalledWith({
      where: { userId: 'vendor-user-1' },
      select: { id: true },
    });

    const findFirstArg = (prisma.rFQ.findFirst as jest.Mock).mock.calls[0][0] as {
      where: {
        id: string;
        status: { in: string[] };
      };
    };
    expect(findFirstArg.where.id).toBe('rfq-1');
    expect(findFirstArg.where.status.in).toContain(RFQStatus.OPEN);
    expect(findFirstArg.where.status.in).toContain(RFQStatus.QUOTED);
  });

  it('vendor with no profile gets NotFoundException', async () => {
    prisma.vendorProfile.findUnique.mockResolvedValueOnce(null);

    await expect(
      service.getRFQ('rfq-1', 'vendor-user-1', UserRole.VENDOR),
    ).rejects.toThrow(NotFoundException);

    expect(prisma.rFQ.findFirst).not.toHaveBeenCalled();
  });

  it('vendor with valid profile but RFQ not found gets NotFoundException', async () => {
    prisma.vendorProfile.findUnique.mockResolvedValueOnce({
      id: 'vp-1',
    });

    prisma.rFQ.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.getRFQ('rfq-1', 'vendor-user-1', UserRole.VENDOR),
    ).rejects.toThrow(NotFoundException);
  });
});
