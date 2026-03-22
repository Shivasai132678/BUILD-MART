import { UserRole, VendorStatus } from '@prisma/client';
import { AdminVendorController } from './admin-vendor.controller';
import type { VendorService } from './vendor.service';

describe('AdminVendorController', () => {
  const vendorService = {
    approveVendor: jest.fn(),
    rejectVendor: jest.fn(),
    updateVendorStatus: jest.fn(),
  } as unknown as jest.Mocked<VendorService>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delegates admin vendor actions to service', async () => {
    const controller = new AdminVendorController(vendorService);
    const req = { user: { sub: 'admin-1', role: UserRole.ADMIN } } as const;

    (vendorService.approveVendor as jest.Mock).mockResolvedValue({ id: 'vp-1' });
    (vendorService.rejectVendor as jest.Mock).mockResolvedValue({ id: 'vp-1', status: VendorStatus.REJECTED });
    (vendorService.updateVendorStatus as jest.Mock).mockResolvedValue({ id: 'vp-1', status: VendorStatus.SUSPENDED });

    await expect(controller.approveVendor('vp-1', req)).resolves.toEqual({ id: 'vp-1' });
    await expect(
      controller.rejectVendor('vp-1', { rejectionReason: 'invalid docs' }, req),
    ).resolves.toEqual({ id: 'vp-1', status: VendorStatus.REJECTED });
    await expect(
      controller.updateVendorStatus('vp-1', { status: VendorStatus.SUSPENDED }, req),
    ).resolves.toEqual({ id: 'vp-1', status: VendorStatus.SUSPENDED });
  });
});
