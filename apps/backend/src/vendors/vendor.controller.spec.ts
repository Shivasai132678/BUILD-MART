import { UnauthorizedException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { VendorController } from './vendor.controller';
import type { VendorService } from './vendor.service';

describe('VendorController', () => {
  const vendorService = {
    discoverVendors: jest.fn(),
    onboard: jest.fn(),
    getProfile: jest.fn(),
    updateProfile: jest.fn(),
    getVendorStats: jest.fn(),
    getVendorProducts: jest.fn(),
    addVendorProducts: jest.fn(),
    removeVendorProduct: jest.fn(),
    getPublicVendorProfile: jest.fn(),
    getPublicVendorProducts: jest.fn(),
  } as unknown as jest.Mocked<VendorService>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delegates all vendor routes to service', async () => {
    const controller = new VendorController(vendorService);
    const req = { user: { sub: 'vendor-user-1', role: UserRole.VENDOR } } as const;

    (vendorService.discoverVendors as jest.Mock).mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0 });
    (vendorService.onboard as jest.Mock).mockResolvedValue({ id: 'vp-1' });
    (vendorService.getProfile as jest.Mock).mockResolvedValue({ id: 'vp-1' });
    (vendorService.updateProfile as jest.Mock).mockResolvedValue({ id: 'vp-1' });
    (vendorService.getVendorStats as jest.Mock).mockResolvedValue({ totalOrders: 0 });
    (vendorService.getVendorProducts as jest.Mock).mockResolvedValue({ items: [] });
    (vendorService.addVendorProducts as jest.Mock).mockResolvedValue({ added: 2 });
    (vendorService.removeVendorProduct as jest.Mock).mockResolvedValue({ removed: true });
    (vendorService.getPublicVendorProfile as jest.Mock).mockResolvedValue({ id: 'vp-public' });
    (vendorService.getPublicVendorProducts as jest.Mock).mockResolvedValue({ items: [] });

    await expect(controller.discoverVendors('Hyd', 'cat-1', 4.5, 20, 0)).resolves.toEqual({
      items: [],
      total: 0,
      limit: 20,
      offset: 0,
    });
    await expect(
      controller.onboard(req, {
        businessName: 'Vendor Co',
        gstNumber: '29ABCDE1234F1Z5',
        serviceableAreas: ['Hyderabad'],
      }),
    ).resolves.toEqual({ id: 'vp-1' });
    await expect(controller.getProfile(req)).resolves.toEqual({ id: 'vp-1' });
    await expect(controller.updateProfile(req, { businessName: 'Vendor Co 2' })).resolves.toEqual({ id: 'vp-1' });
    await expect(controller.getVendorStats(req)).resolves.toEqual({ totalOrders: 0 });
    await expect(controller.getVendorProducts(req)).resolves.toEqual({ items: [] });
    await expect(controller.addVendorProducts(req, { productIds: ['p1', 'p2'] })).resolves.toEqual({
      added: 2,
    });
    await expect(controller.removeVendorProduct(req, 'p1')).resolves.toEqual({ removed: true });
    await expect(controller.getPublicVendorProfile('vp-public')).resolves.toEqual({ id: 'vp-public' });
    await expect(controller.getPublicVendorProducts('vp-public')).resolves.toEqual({ items: [] });
  });

  it('throws UnauthorizedException when authenticated user is missing', async () => {
    const controller = new VendorController(vendorService);

    expect(() => controller.getProfile({} as never)).toThrow(
      UnauthorizedException,
    );
  });
});
