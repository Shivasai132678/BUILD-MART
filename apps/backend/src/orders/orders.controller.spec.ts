import { UnauthorizedException } from '@nestjs/common';
import { OrderStatus, UserRole } from '@prisma/client';
import { OrdersController } from './orders.controller';
import type { OrdersService } from './orders.service';
import type { InvoiceService } from './invoice.service';

describe('OrdersController', () => {
  const ordersService = {
    createDirectOrder: jest.fn(),
    createOrder: jest.fn(),
    listOrders: jest.fn(),
    getOrder: jest.fn(),
    updateOrderStatus: jest.fn(),
    cancelOrder: jest.fn(),
    submitReview: jest.fn(),
  } as unknown as jest.Mocked<OrdersService>;

  const invoiceService = {
    generateInvoice: jest.fn(),
  } as unknown as jest.Mocked<InvoiceService>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delegates authenticated endpoints to service', async () => {
    const controller = new OrdersController(ordersService, invoiceService);
    const request = { user: { sub: 'user-1', role: UserRole.BUYER } } as const;

    (ordersService.createDirectOrder as jest.Mock).mockResolvedValue({ id: 'order-1' });
    (ordersService.createOrder as jest.Mock).mockResolvedValue({ id: 'order-2' });
    (ordersService.listOrders as jest.Mock).mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0 });
    (ordersService.getOrder as jest.Mock).mockResolvedValue({ id: 'order-1' });
    (ordersService.cancelOrder as jest.Mock).mockResolvedValue({ id: 'order-1', status: OrderStatus.CANCELLED });
    (ordersService.submitReview as jest.Mock).mockResolvedValue({ id: 'review-1' });

    await expect(
      controller.createDirectOrder(request, {
        vendorId: 'vendor-1',
        addressId: 'addr-1',
        items: [{ productId: 'prod-1', quantity: '2' }],
      }),
    ).resolves.toEqual({ id: 'order-1' });
    await expect(controller.createOrder(request, { quoteId: 'quote-1' })).resolves.toEqual({
      id: 'order-2',
    });
    await expect(controller.listOrders(request, 20, 0, undefined)).resolves.toEqual({
      items: [],
      total: 0,
      limit: 20,
      offset: 0,
    });
    await expect(controller.getOrder('order-1', request)).resolves.toEqual({ id: 'order-1' });
    await expect(controller.cancelOrder('order-1', request, { cancelReason: 'buyer changed mind' })).resolves.toEqual({
      id: 'order-1',
      status: OrderStatus.CANCELLED,
    });
    await expect(controller.submitReview('order-1', request, { rating: 5, comment: 'great' })).resolves.toEqual({
      id: 'review-1',
    });
  });

  it('uses vendor user id for updateOrderStatus', async () => {
    const controller = new OrdersController(ordersService, invoiceService);
    const request = { user: { sub: 'vendor-user-1', role: UserRole.VENDOR } } as const;
    (ordersService.updateOrderStatus as jest.Mock).mockResolvedValue({ id: 'order-1' });

    await expect(
      controller.updateOrderStatus('order-1', request, { status: OrderStatus.OUT_FOR_DELIVERY }),
    ).resolves.toEqual({ id: 'order-1' });

    expect(ordersService.updateOrderStatus).toHaveBeenCalledWith('order-1', 'vendor-user-1', {
      status: OrderStatus.OUT_FOR_DELIVERY,
    });
  });

  it('streams invoice response from invoice service', async () => {
    const controller = new OrdersController(ordersService, invoiceService);
    const request = { user: { sub: 'user-1', role: UserRole.BUYER } } as const;
    const pdfBuffer = Buffer.from('pdf-binary');
    const response = {
      set: jest.fn(),
      end: jest.fn(),
    };
    (invoiceService.generateInvoice as jest.Mock).mockResolvedValue(pdfBuffer);

    await controller.downloadInvoice('order-1', request, response as unknown as never);

    expect(invoiceService.generateInvoice).toHaveBeenCalledWith('order-1', 'user-1', UserRole.BUYER);
    expect(response.set).toHaveBeenCalledWith(
      expect.objectContaining({
        'Content-Type': 'application/pdf',
        'Content-Length': pdfBuffer.length,
      }),
    );
    expect(response.end).toHaveBeenCalledWith(pdfBuffer);
  });

  it('throws UnauthorizedException when request user context is missing', async () => {
    const controller = new OrdersController(ordersService, invoiceService);

    expect(() => controller.createOrder({} as never, { quoteId: 'quote-1' })).toThrow(
      UnauthorizedException,
    );
  });
});
