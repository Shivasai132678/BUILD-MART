import { UnauthorizedException } from '@nestjs/common';
import { DisputeStatus, UserRole } from '@prisma/client';
import { DisputesController } from './disputes.controller';
import type { DisputesService } from './disputes.service';

describe('DisputesController', () => {
  const disputesService = {
    createDispute: jest.fn(),
    listBuyerDisputes: jest.fn(),
    listVendorDisputes: jest.fn(),
    getDispute: jest.fn(),
    listAllDisputes: jest.fn(),
    resolveDispute: jest.fn(),
  } as unknown as jest.Mocked<DisputesService>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delegates dispute routes for authenticated users', async () => {
    const controller = new DisputesController(disputesService);
    const buyerReq = { user: { sub: 'buyer-1', role: UserRole.BUYER } } as const;
    const vendorReq = { user: { sub: 'vendor-user-1', role: UserRole.VENDOR } } as const;
    const adminReq = { user: { sub: 'admin-1', role: UserRole.ADMIN } } as const;

    (disputesService.createDispute as jest.Mock).mockResolvedValue({ id: 'disp-1' });
    (disputesService.listBuyerDisputes as jest.Mock).mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0 });
    (disputesService.listVendorDisputes as jest.Mock).mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0 });
    (disputesService.getDispute as jest.Mock).mockResolvedValue({ id: 'disp-1' });
    (disputesService.listAllDisputes as jest.Mock).mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0 });
    (disputesService.resolveDispute as jest.Mock).mockResolvedValue({ id: 'disp-1', status: DisputeStatus.RESOLVED });

    await expect(
      controller.create(buyerReq, {
        orderId: 'order-1',
        reason: 'QUALITY_ISSUE',
        description: 'Damaged bags',
      }),
    ).resolves.toEqual({ id: 'disp-1' });
    expect(disputesService.createDispute).toHaveBeenCalledWith('buyer-1', {
      orderId: 'order-1',
      reason: 'QUALITY_ISSUE',
      description: 'Damaged bags',
    });
    await expect(controller.listMine(buyerReq, 20, 0, DisputeStatus.OPEN)).resolves.toEqual({
      items: [],
      total: 0,
      limit: 20,
      offset: 0,
    });
    expect(disputesService.listBuyerDisputes).toHaveBeenCalledWith(
      'buyer-1',
      20,
      0,
      DisputeStatus.OPEN,
    );
    await expect(controller.listVendor(vendorReq, 20, 0, DisputeStatus.OPEN)).resolves.toEqual({
      items: [],
      total: 0,
      limit: 20,
      offset: 0,
    });
    expect(disputesService.listVendorDisputes).toHaveBeenCalledWith(
      'vendor-user-1',
      20,
      0,
      DisputeStatus.OPEN,
    );
    await expect(controller.getOne(buyerReq, 'disp-1')).resolves.toEqual({ id: 'disp-1' });
    expect(disputesService.getDispute).toHaveBeenCalledWith('disp-1', 'buyer-1');
    await expect(controller.listAll(20, 0, DisputeStatus.OPEN)).resolves.toEqual({
      items: [],
      total: 0,
      limit: 20,
      offset: 0,
    });
    expect(disputesService.listAllDisputes).toHaveBeenCalledWith(
      20,
      0,
      DisputeStatus.OPEN,
    );
    await expect(
      controller.resolve(adminReq, 'disp-1', {
        status: DisputeStatus.RESOLVED,
        adminNotes: 'resolved',
      }),
    ).resolves.toEqual({ id: 'disp-1', status: DisputeStatus.RESOLVED });
    expect(disputesService.resolveDispute).toHaveBeenCalledWith('disp-1', 'admin-1', {
      status: DisputeStatus.RESOLVED,
      adminNotes: 'resolved',
    });
  });

  it('throws UnauthorizedException when user context is missing', async () => {
    const controller = new DisputesController(disputesService);

    await expect(
      controller.create({} as never, {
        orderId: 'order-1',
        reason: 'QUALITY_ISSUE',
        description: 'Damaged bags',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
