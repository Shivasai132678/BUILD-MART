import { UnauthorizedException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { QuotesController } from './quotes.controller';
import type { QuotesService } from './quotes.service';

describe('QuotesController', () => {
  const quotesService = {
    createQuote: jest.fn(),
    getQuotesForRFQ: jest.fn(),
    updateQuote: jest.fn(),
    deleteQuote: jest.fn(),
    getVendorQuoteForRfq: jest.fn(),
    counterOfferQuote: jest.fn(),
    respondToCounterOffer: jest.fn(),
  } as unknown as jest.Mocked<QuotesService>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delegates quote routes with authenticated user id', async () => {
    const controller = new QuotesController(quotesService);
    const buyerRequest = { user: { sub: 'buyer-1', role: UserRole.BUYER } } as const;
    const vendorRequest = { user: { sub: 'vendor-1', role: UserRole.VENDOR } } as const;

    (quotesService.createQuote as jest.Mock).mockResolvedValue({ id: 'quote-1' });
    (quotesService.getQuotesForRFQ as jest.Mock).mockResolvedValue({ data: [], total: 0, limit: 20, offset: 0 });
    (quotesService.updateQuote as jest.Mock).mockResolvedValue({ id: 'quote-1' });
    (quotesService.deleteQuote as jest.Mock).mockResolvedValue({ message: 'Quote deleted' });
    (quotesService.getVendorQuoteForRfq as jest.Mock).mockResolvedValue({ id: 'quote-1' });
    (quotesService.counterOfferQuote as jest.Mock).mockResolvedValue({ id: 'quote-1', counterStatus: 'PENDING' });
    (quotesService.respondToCounterOffer as jest.Mock).mockResolvedValue({ id: 'quote-1', counterStatus: 'ACCEPTED' });

    await expect(
      controller.createQuote(vendorRequest, {
        rfqId: 'rfq-1',
        subtotal: '100.00',
        taxAmount: '10.00',
        deliveryFee: '0.00',
        totalAmount: '110.00',
        validUntil: '2030-01-01T00:00:00.000Z',
        items: [{ productName: 'Cement', quantity: '1', unit: 'bag', unitPrice: '100.00', subtotal: '100.00' }],
      }),
    ).resolves.toEqual({ id: 'quote-1' });
    expect(quotesService.createQuote).toHaveBeenCalledWith(
      'vendor-1',
      expect.objectContaining({
        rfqId: 'rfq-1',
        subtotal: '100.00',
      }),
    );

    await expect(controller.getQuotesForRFQ('rfq-1', buyerRequest, 20, 0)).resolves.toEqual({
      data: [],
      total: 0,
      limit: 20,
      offset: 0,
    });
    expect(quotesService.getQuotesForRFQ).toHaveBeenCalledWith(
      'rfq-1',
      'buyer-1',
      20,
      0,
    );

    await expect(controller.updateQuote('quote-1', vendorRequest, { notes: 'updated' })).resolves.toEqual({
      id: 'quote-1',
    });
    expect(quotesService.updateQuote).toHaveBeenCalledWith('quote-1', 'vendor-1', {
      notes: 'updated',
    });

    await expect(controller.deleteQuote('quote-1', vendorRequest)).resolves.toEqual({
      message: 'Quote deleted',
    });
    expect(quotesService.deleteQuote).toHaveBeenCalledWith('quote-1', 'vendor-1');

    await expect(controller.getVendorQuoteForRfq('rfq-1', vendorRequest)).resolves.toEqual({
      id: 'quote-1',
    });
    expect(quotesService.getVendorQuoteForRfq).toHaveBeenCalledWith('rfq-1', 'vendor-1');

    await expect(
      controller.counterOfferQuote('quote-1', buyerRequest, {
        counterOfferPrice: '105.00',
      }),
    ).resolves.toEqual({ id: 'quote-1', counterStatus: 'PENDING' });
    expect(quotesService.counterOfferQuote).toHaveBeenCalledWith('buyer-1', 'quote-1', {
      counterOfferPrice: '105.00',
    });

    await expect(controller.respondToCounterOffer('quote-1', vendorRequest, true)).resolves.toEqual({
      id: 'quote-1',
      counterStatus: 'ACCEPTED',
    });
    expect(quotesService.respondToCounterOffer).toHaveBeenCalledWith(
      'vendor-1',
      'quote-1',
      true,
    );
  });

  it('throws UnauthorizedException when request user is missing', () => {
    const controller = new QuotesController(quotesService);

    expect(() => controller.deleteQuote('quote-1', {} as never)).toThrow(
      UnauthorizedException,
    );

    expect(() =>
      controller.createQuote({} as never, {
        rfqId: 'rfq-1',
        subtotal: '100.00',
        taxAmount: '10.00',
        deliveryFee: '0.00',
        totalAmount: '110.00',
        validUntil: '2030-01-01T00:00:00.000Z',
        items: [
          {
            productName: 'Cement',
            quantity: '1',
            unit: 'bag',
            unitPrice: '100.00',
            subtotal: '100.00',
          },
        ],
      }),
    ).toThrow(UnauthorizedException);

    expect(() => controller.getQuotesForRFQ('rfq-1', {} as never, 20, 0)).toThrow(
      UnauthorizedException,
    );

    expect(() =>
      controller.updateQuote('quote-1', {} as never, {
        notes: 'updated',
      }),
    ).toThrow(UnauthorizedException);

    expect(() =>
      controller.getVendorQuoteForRfq('rfq-1', {} as never),
    ).toThrow(UnauthorizedException);

    expect(() =>
      controller.counterOfferQuote('quote-1', {} as never, {
        counterOfferPrice: '105.00',
      }),
    ).toThrow(UnauthorizedException);

    expect(() =>
      controller.respondToCounterOffer('quote-1', {} as never, true),
    ).toThrow(UnauthorizedException);
  });
});
