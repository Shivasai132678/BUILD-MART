import { UnauthorizedException } from '@nestjs/common';
import { RFQStatus, UserRole } from '@prisma/client';
import { RfqController } from './rfq.controller';
import type { RfqService } from './rfq.service';

describe('RfqController', () => {
  const rfqService = {
    createRFQ: jest.fn(),
    listRFQs: jest.fn(),
    getAvailableRFQs: jest.fn(),
    browseAllRFQs: jest.fn(),
    getRFQ: jest.fn(),
    closeRFQ: jest.fn(),
  } as unknown as jest.Mocked<RfqService>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delegates all RFQ operations for authenticated user', async () => {
    const controller = new RfqController(rfqService);
    const buyerRequest = { user: { sub: 'buyer-1', role: UserRole.BUYER } } as const;
    const vendorRequest = { user: { sub: 'vendor-1', role: UserRole.VENDOR } } as const;

    (rfqService.createRFQ as jest.Mock).mockResolvedValue({ id: 'rfq-1' });
    (rfqService.listRFQs as jest.Mock).mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0 });
    (rfqService.getAvailableRFQs as jest.Mock).mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0 });
    (rfqService.browseAllRFQs as jest.Mock).mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0 });
    (rfqService.getRFQ as jest.Mock).mockResolvedValue({ id: 'rfq-1' });
    (rfqService.closeRFQ as jest.Mock).mockResolvedValue({ id: 'rfq-1', status: RFQStatus.CLOSED });

    await expect(
      controller.createRFQ(buyerRequest, {
        addressId: 'addr-1',
        validUntil: '2030-01-01T00:00:00.000Z',
        items: [{ productId: 'prod-1', quantity: '5', unit: 'bag' }],
      }),
    ).resolves.toEqual({ id: 'rfq-1' });

    await expect(controller.listRFQs(buyerRequest, 20, 0, RFQStatus.OPEN)).resolves.toEqual({
      items: [],
      total: 0,
      limit: 20,
      offset: 0,
    });

    await expect(controller.getAvailableRFQs(vendorRequest, 20, 0)).resolves.toEqual({
      items: [],
      total: 0,
      limit: 20,
      offset: 0,
    });

    await expect(controller.browseAllRFQs(vendorRequest, 20, 0, 'cat-1')).resolves.toEqual({
      items: [],
      total: 0,
      limit: 20,
      offset: 0,
    });

    await expect(controller.getRFQ('rfq-1', buyerRequest)).resolves.toEqual({ id: 'rfq-1' });
    await expect(controller.closeRFQ('rfq-1', buyerRequest)).resolves.toEqual({
      id: 'rfq-1',
      status: RFQStatus.CLOSED,
    });
  });

  it('throws UnauthorizedException when user context is missing', async () => {
    const controller = new RfqController(rfqService);

    expect(() => controller.listRFQs({} as never, 20, 0, undefined)).toThrow(
      UnauthorizedException,
    );
  });
});
