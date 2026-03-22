import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { InvoiceService } from './invoice.service';

const decimal = (value: string) => ({ toString: () => value });

const baseOrder = {
  id: 'order-1',
  referenceCode: 'ORD-001',
  totalAmount: decimal('1000.00'),
  status: 'CONFIRMED',
  paymentMethod: 'COD',
  confirmedAt: new Date('2026-01-01T00:00:00.000Z'),
  deliveredAt: null,
  buyerId: 'buyer-1',
  vendorId: 'vendor-1',
  buyer: { name: 'Buyer One', phone: '+911234567890', email: 'buyer@example.com' },
  vendor: {
    businessName: 'Vendor Co',
    city: 'Hyderabad',
    gstNumber: '29ABCDE1234F1Z5',
    user: { phone: '+919999999999' },
  },
  quote: {
    subtotal: decimal('800.00'),
    taxAmount: decimal('100.00'),
    deliveryFee: decimal('100.00'),
    totalAmount: decimal('1000.00'),
    items: [
      {
        productName: 'OPC 53',
        quantity: decimal('10'),
        unit: 'bag',
        unitPrice: decimal('80.00'),
        subtotal: decimal('800.00'),
      },
    ],
  },
  directItems: [],
  rfq: { referenceCode: 'RFQ-001', title: 'Cement' },
  payment: { status: 'SUCCESS', razorpayPaymentId: 'pay_123' },
};

describe('InvoiceService', () => {
  let service: InvoiceService;

  const prisma = {
    order: {
      findUnique: jest.fn(),
    },
    vendorProfile: {
      findUnique: jest.fn(),
    },
  } as unknown as jest.Mocked<PrismaService>;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new InvoiceService(prisma);
  });

  it('throws NotFound when order does not exist', async () => {
    (prisma.order.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(
      service.generateInvoice('missing', 'buyer-1', UserRole.BUYER),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws Forbidden for buyer not owning order', async () => {
    (prisma.order.findUnique as jest.Mock).mockResolvedValue(baseOrder);

    await expect(
      service.generateInvoice('order-1', 'buyer-2', UserRole.BUYER),
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws Forbidden for vendor without matching vendor profile', async () => {
    (prisma.order.findUnique as jest.Mock).mockResolvedValue(baseOrder);
    (prisma.vendorProfile.findUnique as jest.Mock).mockResolvedValue({ id: 'vendor-2' });

    await expect(
      service.generateInvoice('order-1', 'vendor-user-2', UserRole.VENDOR),
    ).rejects.toThrow(ForbiddenException);
  });

  it('returns pdf buffer for buyer owning order', async () => {
    (prisma.order.findUnique as jest.Mock).mockResolvedValue(baseOrder);

    const buffer = await service.generateInvoice('order-1', 'buyer-1', UserRole.BUYER);

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(100);
  });

  it('returns pdf buffer for vendor owning order', async () => {
    (prisma.order.findUnique as jest.Mock).mockResolvedValue(baseOrder);
    (prisma.vendorProfile.findUnique as jest.Mock).mockResolvedValue({ id: 'vendor-1' });

    const buffer = await service.generateInvoice('order-1', 'vendor-user-1', UserRole.VENDOR);

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(100);
  });

  it('generates invoice for direct item orders without quote', async () => {
    (prisma.order.findUnique as jest.Mock).mockResolvedValue({
      ...baseOrder,
      quote: null,
      directItems: [
        {
          productName: 'Steel Rod',
          quantity: decimal('5'),
          unit: 'piece',
          unitPrice: decimal('200.00'),
          subtotal: decimal('1000.00'),
        },
      ],
    });

    const buffer = await service.generateInvoice('order-1', 'buyer-1', UserRole.BUYER);

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(100);
  });
});
