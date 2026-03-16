import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { NotificationType, RFQStatus, VendorStatus } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { QuotesService } from './quotes.service';

describe('QuotesService', () => {
  let service: QuotesService;

  const prisma = {
    vendorProfile: {
      findUnique: jest.fn(),
    },
    rFQ: {
      findUnique: jest.fn(),
    },
    quote: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    quoteItem: {
      createMany: jest.fn(),
    },
    order: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  } as unknown as jest.Mocked<PrismaService>;

  const notificationsService = {
    create: jest.fn(),
  } as unknown as NotificationsService;

  const mockDto = {
    rfqId: 'rfq-1',
    subtotal: '1000.00',
    taxAmount: '180.00',
    deliveryFee: '50.00',
    totalAmount: '1230.00',
    validUntil: '2026-03-15T00:00:00.000Z',
    items: [
      {
        productName: 'OPC Cement 50kg',
        quantity: '100',
        unit: 'bags',
        unitPrice: '10.00',
        subtotal: '1000.00',
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (notificationsService.create as jest.Mock).mockResolvedValue(undefined);
    service = new QuotesService(prisma, notificationsService);
  });

  describe('createQuote', () => {
    it('successfully creates a quote for a valid vendor + RFQ', async () => {
      (prisma.vendorProfile.findUnique as jest.Mock).mockResolvedValue({ id: 'vendor-profile-1', status: VendorStatus.APPROVED });
      (prisma.rFQ.findUnique as jest.Mock).mockResolvedValue({
        id: 'rfq-1',
        buyerId: 'buyer-1',
        status: RFQStatus.OPEN,
      });
      (prisma.quote.findUnique as jest.Mock).mockResolvedValue(null);

      const createdQuote = {
        id: 'quote-1',
        rfqId: 'rfq-1',
        vendorId: 'vendor-profile-1',
        totalAmount: new Prisma.Decimal('1230.00'),
        items: [{ id: 'item-1', productName: 'OPC Cement 50kg' }],
      };

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback: Function) => {
        const tx = {
          $executeRaw: jest.fn().mockResolvedValue(undefined),
          $queryRaw: jest.fn().mockResolvedValue([{ referenceCode: 'QUO-00001' }]),
          quote: {
            create: jest.fn().mockResolvedValue({ id: 'quote-1' }),
            findUnique: jest.fn().mockResolvedValue(createdQuote),
          },
          quoteItem: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
          rFQ: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
        };
        return callback(tx);
      });

      const result = await service.createQuote('vendor-user-1', mockDto);

      expect(result).toEqual(createdQuote);
      expect(prisma.vendorProfile.findUnique).toHaveBeenCalledWith({
        where: { userId: 'vendor-user-1' },
        select: { id: true, status: true },
      });
      expect(notificationsService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'buyer-1',
          type: NotificationType.QUOTE_RECEIVED,
          title: 'New quote received',
          message: expect.stringContaining('rfq-1'),
          metadata: expect.objectContaining({ rfqId: 'rfq-1', quoteId: 'quote-1' }),
        }),
      );
    });

    it('throws ConflictException if vendor already submitted a quote for the same RFQ', async () => {
      (prisma.vendorProfile.findUnique as jest.Mock).mockResolvedValue({ id: 'vendor-profile-1', status: VendorStatus.APPROVED });
      (prisma.rFQ.findUnique as jest.Mock).mockResolvedValue({
        id: 'rfq-1',
        buyerId: 'buyer-1',
        status: RFQStatus.OPEN,
      });
      (prisma.quote.findUnique as jest.Mock).mockResolvedValue({ id: 'existing-quote-1' });

      await expect(service.createQuote('vendor-user-1', mockDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('throws NotFoundException if RFQ does not exist', async () => {
      (prisma.vendorProfile.findUnique as jest.Mock).mockResolvedValue({ id: 'vendor-profile-1', status: VendorStatus.APPROVED });
      (prisma.rFQ.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.createQuote('vendor-user-1', mockDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException if RFQ is CLOSED status', async () => {
      (prisma.vendorProfile.findUnique as jest.Mock).mockResolvedValue({ id: 'vendor-profile-1', status: VendorStatus.APPROVED });
      (prisma.rFQ.findUnique as jest.Mock).mockResolvedValue({
        id: 'rfq-1',
        buyerId: 'buyer-1',
        status: RFQStatus.CLOSED,
      });

      await expect(service.createQuote('vendor-user-1', mockDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws NotFoundException if vendor profile does not exist', async () => {
      (prisma.vendorProfile.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.createQuote('vendor-user-1', mockDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ConflictException on Prisma P2002 unique constraint violation', async () => {
      (prisma.vendorProfile.findUnique as jest.Mock).mockResolvedValue({ id: 'vendor-profile-1', status: VendorStatus.APPROVED });
      (prisma.rFQ.findUnique as jest.Mock).mockResolvedValue({
        id: 'rfq-1',
        buyerId: 'buyer-1',
        status: RFQStatus.OPEN,
      });
      (prisma.quote.findUnique as jest.Mock).mockResolvedValue(null);

      const p2002Error = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        { code: 'P2002', clientVersion: '6.0.0' },
      );
      (prisma.$transaction as jest.Mock).mockRejectedValue(p2002Error);

      await expect(service.createQuote('vendor-user-1', mockDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('getQuotesForRFQ', () => {
    it('returns paginated quotes with total, limit, offset', async () => {
      (prisma.rFQ.findUnique as jest.Mock).mockResolvedValue({ id: 'rfq-1', buyerId: 'buyer-1' });

      const mockQuotes = [
        { id: 'q1', totalAmount: new Prisma.Decimal('1000.00'), items: [] },
        { id: 'q2', totalAmount: new Prisma.Decimal('1200.00'), items: [] },
      ];

      (prisma.$transaction as jest.Mock).mockResolvedValue([mockQuotes, 2]);

      const result = await service.getQuotesForRFQ('rfq-1', 'buyer-1', 20, 0);

      expect(result).toEqual({
        data: mockQuotes,
        total: 2,
        limit: 20,
        offset: 0,
      });
    });

    it('returns empty data array when no quotes exist', async () => {
      (prisma.rFQ.findUnique as jest.Mock).mockResolvedValue({ id: 'rfq-1', buyerId: 'buyer-1' });
      (prisma.$transaction as jest.Mock).mockResolvedValue([[], 0]);

      const result = await service.getQuotesForRFQ('rfq-1', 'buyer-1', 20, 0);

      expect(result.data).toEqual([]);
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.total).toBe(0);
    });

    it('throws ForbiddenException if buyer does not own the RFQ', async () => {
      (prisma.rFQ.findUnique as jest.Mock).mockResolvedValue({ id: 'rfq-1', buyerId: 'buyer-1' });

      await expect(
        service.getQuotesForRFQ('rfq-1', 'different-buyer', 20, 0),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException if RFQ does not exist', async () => {
      (prisma.rFQ.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.getQuotesForRFQ('rfq-nonexistent', 'buyer-1', 20, 0),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteQuote', () => {
    it('deletes a quote owned by the vendor with no existing order', async () => {
      (prisma.vendorProfile.findUnique as jest.Mock).mockResolvedValue({ id: 'vendor-profile-1' });
      (prisma.quote.findUnique as jest.Mock).mockResolvedValue({
        id: 'quote-1',
        vendorId: 'vendor-profile-1',
      });
      (prisma.order.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.quote.delete as jest.Mock).mockResolvedValue({ id: 'quote-1' });

      const result = await service.deleteQuote('quote-1', 'vendor-user-1');

      expect(result).toEqual({ message: 'Quote deleted' });
      expect(prisma.quote.delete).toHaveBeenCalledWith({
        where: { id: 'quote-1' },
      });
    });

    it('throws ForbiddenException if vendor does not own the quote', async () => {
      (prisma.vendorProfile.findUnique as jest.Mock).mockResolvedValue({ id: 'vendor-profile-2' });
      (prisma.quote.findUnique as jest.Mock).mockResolvedValue({
        id: 'quote-1',
        vendorId: 'vendor-profile-1',
      });

      await expect(service.deleteQuote('quote-1', 'vendor-user-2')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws BadRequestException if an order exists for the quote', async () => {
      (prisma.vendorProfile.findUnique as jest.Mock).mockResolvedValue({ id: 'vendor-profile-1' });
      (prisma.quote.findUnique as jest.Mock).mockResolvedValue({
        id: 'quote-1',
        vendorId: 'vendor-profile-1',
      });
      (prisma.order.findUnique as jest.Mock).mockResolvedValue({ id: 'order-1' });

      await expect(service.deleteQuote('quote-1', 'vendor-user-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
