import { UnauthorizedException } from '@nestjs/common';
import { OrderStatus, UserRole, VendorStatus } from '@prisma/client';
import { AdminController } from './admin.controller';
import type { AdminService } from './admin.service';

describe('AdminController', () => {
  const adminService = {
    getMetrics: jest.fn(),
    getPendingVendors: jest.fn(),
    listAllOrders: jest.fn(),
    getOrderById: jest.fn(),
    getAllUsers: jest.fn(),
    getAllVendors: jest.fn(),
    getAllRfqs: jest.fn(),
    forceCancelOrder: jest.fn(),
    flagOrder: jest.fn(),
    bulkApproveVendors: jest.fn(),
    bulkSuspendVendors: jest.fn(),
  } as unknown as jest.Mocked<AdminService>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delegates admin routes to service', async () => {
    const controller = new AdminController(adminService);
    const req = { user: { sub: 'admin-1', role: UserRole.ADMIN } } as const;

    (adminService.getMetrics as jest.Mock).mockResolvedValue({ totalUsers: 1 });
    (adminService.getPendingVendors as jest.Mock).mockResolvedValue({ data: [], total: 0, limit: 20, offset: 0 });
    (adminService.listAllOrders as jest.Mock).mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0 });
    (adminService.getOrderById as jest.Mock).mockResolvedValue({ id: 'order-1' });
    (adminService.getAllUsers as jest.Mock).mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0 });
    (adminService.getAllVendors as jest.Mock).mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0 });
    (adminService.getAllRfqs as jest.Mock).mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0 });
    (adminService.forceCancelOrder as jest.Mock).mockResolvedValue({ id: 'order-1' });
    (adminService.flagOrder as jest.Mock).mockResolvedValue({ id: 'order-1' });
    (adminService.bulkApproveVendors as jest.Mock).mockResolvedValue({ approved: 1, skipped: 0 });
    (adminService.bulkSuspendVendors as jest.Mock).mockResolvedValue({ suspended: 1, skipped: 0 });

    await expect(controller.getMetrics()).resolves.toEqual({ totalUsers: 1 });
    await expect(controller.getPendingVendors(20, 0)).resolves.toEqual({
      data: [],
      total: 0,
      limit: 20,
      offset: 0,
    });
    await expect(controller.listAllOrders(20, 0, OrderStatus.CONFIRMED)).resolves.toEqual({
      items: [],
      total: 0,
      limit: 20,
      offset: 0,
    });
    await expect(controller.getOrderById('order-1')).resolves.toEqual({ id: 'order-1' });
    await expect(controller.getAllUsers(20, 0)).resolves.toEqual({
      items: [],
      total: 0,
      limit: 20,
      offset: 0,
    });
    await expect(controller.getAllVendors(20, 0, VendorStatus.APPROVED)).resolves.toEqual({
      items: [],
      total: 0,
      limit: 20,
      offset: 0,
    });
    await expect(controller.getAllRfqs(20, 0)).resolves.toEqual({
      items: [],
      total: 0,
      limit: 20,
      offset: 0,
    });
    await expect(controller.forceCancelOrder('order-1', req)).resolves.toEqual({ id: 'order-1' });
    await expect(controller.flagOrder('order-1', req, { reason: 'fraud check' })).resolves.toEqual({
      id: 'order-1',
    });
    await expect(controller.bulkApproveVendors(req, { vendorIds: ['vp-1'] })).resolves.toEqual({
      approved: 1,
      skipped: 0,
    });
    await expect(controller.bulkSuspendVendors(req, { vendorIds: ['vp-1'] })).resolves.toEqual({
      suspended: 1,
      skipped: 0,
    });
  });

  it('throws UnauthorizedException for admin actions requiring admin user context', async () => {
    const controller = new AdminController(adminService);

    expect(() => controller.forceCancelOrder('order-1', {} as never)).toThrow(
      UnauthorizedException,
    );
  });
});
