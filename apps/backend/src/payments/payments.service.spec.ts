import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationType, PaymentStatus } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { createHmac } from 'node:crypto';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentsService } from './payments.service';

const WEBHOOK_SECRET = 'test-webhook-secret-12345';

function buildWebhookBody(event: string, razorpayOrderId: string, paymentId?: string): string {
  return JSON.stringify({
    event,
    payload: {
      payment: {
        entity: {
          id: paymentId ?? 'pay_test_123',
          order_id: razorpayOrderId,
        },
      },
    },
  });
}

function generateSignature(body: string, secret: string): string {
  return createHmac('sha256', secret).update(Buffer.from(body)).digest('hex');
}

describe('PaymentsService', () => {
  let service: PaymentsService;

  const prisma = {
    order: {
      findUnique: jest.fn(),
    },
    payment: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
    },
  } as unknown as jest.Mocked<PrismaService>;

  const configValues: Record<string, string | undefined> = {
    RAZORPAY_KEY_ID: 'rzp_test_key_id',
    RAZORPAY_KEY_SECRET: 'rzp_test_key_secret',
    RAZORPAY_WEBHOOK_SECRET: WEBHOOK_SECRET,
  };

  const configService = {
    get: jest.fn((key: string) => configValues[key]),
  } as unknown as ConfigService;

  const notificationsService = {
    create: jest.fn(),
  } as unknown as NotificationsService;

  beforeEach(() => {
    jest.clearAllMocks();
    (configService.get as jest.Mock).mockImplementation((key: string) => configValues[key]);
    (notificationsService.create as jest.Mock).mockResolvedValue({ id: 'notif-1' });

    service = new PaymentsService(prisma, configService, notificationsService);
  });

  describe('createPaymentOrder', () => {
    it('creates a Razorpay order and persists Payment record', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue({
        id: 'order-1',
        buyerId: 'buyer-1',
        status: 'CONFIRMED',
        totalAmount: new Prisma.Decimal('5000.00'),
        payment: null,
      });

      (prisma.payment.upsert as jest.Mock).mockResolvedValue({
        id: 'payment-1',
        orderId: 'order-1',
        razorpayOrderId: 'order_rzp_mock',
        status: PaymentStatus.INITIATED,
      });

      // Mock Razorpay client by accessing the private method indirectly
      // We need to make getRazorpayClientOrThrow return a mock
      const mockRazorpay = {
        orders: {
          create: jest.fn().mockResolvedValue({
            id: 'order_rzp_mock',
            amount: 500000,
            currency: 'INR',
          }),
        },
      };
      (service as unknown as { razorpayClient: unknown }).razorpayClient = mockRazorpay;

      const result = await service.createPaymentOrder('buyer-1', { orderId: 'order-1' });

      expect(result).toEqual({
        razorpayOrderId: 'order_rzp_mock',
        amount: 500000,
        currency: 'INR',
        key: 'rzp_test_key_id',
      });

      expect(mockRazorpay.orders.create).toHaveBeenCalledWith({
        amount: 500000,
        currency: 'INR',
        receipt: 'order-1',
      });

      expect(prisma.payment.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { orderId: 'order-1' },
          create: expect.objectContaining({
            orderId: 'order-1',
            razorpayOrderId: 'order_rzp_mock',
            status: PaymentStatus.INITIATED,
          }),
        }),
      );
    });

    it('throws NotFoundException if order does not exist', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.createPaymentOrder('buyer-1', { orderId: 'order-nonexistent' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException if buyer does not own the order', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue({
        id: 'order-1',
        buyerId: 'buyer-1',
        status: 'CONFIRMED',
        totalAmount: new Prisma.Decimal('5000.00'),
        payment: null,
      });

      await expect(
        service.createPaymentOrder('different-buyer', { orderId: 'order-1' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ServiceUnavailableException if Razorpay credentials are not configured', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue({
        id: 'order-1',
        buyerId: 'buyer-1',
        status: 'CONFIRMED',
        totalAmount: new Prisma.Decimal('5000.00'),
        payment: null,
      });

      // Clear the cached client and remove config
      (service as unknown as { razorpayClient: unknown }).razorpayClient = null;
      (configService.get as jest.Mock).mockReturnValue(undefined);

      await expect(
        service.createPaymentOrder('buyer-1', { orderId: 'order-1' }),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('throws ConflictException if payment already completed for this order', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue({
        id: 'order-1',
        buyerId: 'buyer-1',
        status: 'CONFIRMED',
        totalAmount: new Prisma.Decimal('5000.00'),
        payment: { status: PaymentStatus.SUCCESS },
      });

      await expect(
        service.createPaymentOrder('buyer-1', { orderId: 'order-1' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('handleWebhook', () => {
    it('marks payment SUCCESS on valid payment.captured event', async () => {
      const body = buildWebhookBody('payment.captured', 'order_rzp_1', 'pay_1');
      const signature = generateSignature(body, WEBHOOK_SECRET);

      (prisma.payment.findUnique as jest.Mock).mockResolvedValue({
        id: 'payment-1',
        orderId: 'order-1',
        razorpayOrderId: 'order_rzp_1',
        status: PaymentStatus.INITIATED,
        razorpayPaymentId: null,
      });

      (prisma.payment.update as jest.Mock).mockResolvedValue({
        id: 'payment-1',
        orderId: 'order-1',
        status: PaymentStatus.SUCCESS,
      });

      (prisma.order.findUnique as jest.Mock).mockResolvedValue({
        id: 'order-1',
        buyerId: 'buyer-1',
      });

      const result = await service.handleWebhook(Buffer.from(body), signature);

      expect(result).toEqual({ received: true });
      expect(prisma.payment.update).toHaveBeenCalledWith({
        where: { id: 'payment-1' },
        data: expect.objectContaining({
          status: PaymentStatus.SUCCESS,
          razorpayPaymentId: 'pay_1',
          webhookVerified: true,
        }),
      });
    });

    it('returns ack when webhook payload misses payment.entity.order_id', async () => {
      const body = JSON.stringify({
        event: 'payment.captured',
        payload: { payment: { entity: { id: 'pay_without_order' } } },
      });
      const signature = generateSignature(body, WEBHOOK_SECRET);

      const result = await service.handleWebhook(Buffer.from(body), signature);

      expect(result).toEqual({ received: true });
      expect(prisma.payment.findUnique).not.toHaveBeenCalled();
    });

    it('returns ack when payment row is missing for webhook order id', async () => {
      const body = buildWebhookBody('payment.captured', 'order_rzp_missing');
      const signature = generateSignature(body, WEBHOOK_SECRET);

      (prisma.payment.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.handleWebhook(Buffer.from(body), signature);

      expect(result).toEqual({ received: true });
      expect(prisma.payment.update).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException on invalid HMAC signature', async () => {
      const body = buildWebhookBody('payment.captured', 'order_rzp_1');
      const invalidSignature = 'invalid-signature-value';

      await expect(
        service.handleWebhook(Buffer.from(body), invalidSignature),
      ).rejects.toThrow('Invalid Razorpay signature');
      expect(prisma.payment.update).not.toHaveBeenCalled();
    });

    it('is idempotent — duplicate SUCCESS webhook is silently ignored (Rule 14)', async () => {
      const body = buildWebhookBody('payment.captured', 'order_rzp_1');
      const signature = generateSignature(body, WEBHOOK_SECRET);

      (prisma.payment.findUnique as jest.Mock).mockResolvedValue({
        id: 'payment-1',
        orderId: 'order-1',
        razorpayOrderId: 'order_rzp_1',
        status: PaymentStatus.SUCCESS,
      });

      const result = await service.handleWebhook(Buffer.from(body), signature);

      expect(result).toEqual({ received: true });
      expect(prisma.payment.update).not.toHaveBeenCalled();
      expect(notificationsService.create).not.toHaveBeenCalled();
    });

    it('returns ack for unhandled event types without mutating payment', async () => {
      const body = buildWebhookBody('payment.authorized', 'order_rzp_authorized');
      const signature = generateSignature(body, WEBHOOK_SECRET);

      (prisma.payment.findUnique as jest.Mock).mockResolvedValue({
        id: 'payment-auth-1',
        orderId: 'order-auth-1',
        razorpayOrderId: 'order_rzp_authorized',
        status: PaymentStatus.INITIATED,
      });

      const result = await service.handleWebhook(Buffer.from(body), signature);

      expect(result).toEqual({ received: true });
      expect(prisma.payment.update).not.toHaveBeenCalled();
    });

    it('marks payment FAILED on payment.failed event', async () => {
      const bodyObj = {
        event: 'payment.failed',
        payload: {
          payment: {
            entity: {
              id: 'pay_fail_1',
              order_id: 'order_rzp_2',
              error_description: 'Insufficient funds',
            },
          },
        },
      };
      const body = JSON.stringify(bodyObj);
      const signature = generateSignature(body, WEBHOOK_SECRET);

      (prisma.payment.findUnique as jest.Mock).mockResolvedValue({
        id: 'payment-2',
        orderId: 'order-2',
        razorpayOrderId: 'order_rzp_2',
        status: PaymentStatus.INITIATED,
      });

      (prisma.payment.update as jest.Mock).mockResolvedValue({
        id: 'payment-2',
        orderId: 'order-2',
        status: PaymentStatus.FAILED,
      });

      (prisma.order.findUnique as jest.Mock).mockResolvedValue({
        id: 'order-2',
        buyerId: 'buyer-2',
      });

      const result = await service.handleWebhook(Buffer.from(body), signature);

      expect(result).toEqual({ received: true });
      expect(prisma.payment.update).toHaveBeenCalledWith({
        where: { id: 'payment-2' },
        data: expect.objectContaining({
          status: PaymentStatus.FAILED,
          webhookVerified: true,
          failureReason: 'Insufficient funds',
        }),
      });
    });

    it('calls NotificationsService on SUCCESS', async () => {
      const body = buildWebhookBody('payment.captured', 'order_rzp_3', 'pay_3');
      const signature = generateSignature(body, WEBHOOK_SECRET);

      (prisma.payment.findUnique as jest.Mock).mockResolvedValue({
        id: 'payment-3',
        orderId: 'order-3',
        razorpayOrderId: 'order_rzp_3',
        status: PaymentStatus.INITIATED,
        razorpayPaymentId: null,
      });

      (prisma.payment.update as jest.Mock).mockResolvedValue({
        id: 'payment-3',
        orderId: 'order-3',
        status: PaymentStatus.SUCCESS,
      });

      (prisma.order.findUnique as jest.Mock).mockResolvedValue({
        id: 'order-3',
        buyerId: 'buyer-3',
      });

      await service.handleWebhook(Buffer.from(body), signature);

      expect(notificationsService.create).toHaveBeenCalledWith({
        userId: 'buyer-3',
        type: NotificationType.PAYMENT_SUCCESS,
        title: 'Payment confirmed',
        message: expect.stringContaining('order-3'),
        metadata: expect.objectContaining({ orderId: 'order-3', paymentId: 'payment-3' }),
      });
    });

    it('calls NotificationsService on FAILED', async () => {
      const body = buildWebhookBody('payment.failed', 'order_rzp_4', 'pay_4');
      const signature = generateSignature(body, WEBHOOK_SECRET);

      (prisma.payment.findUnique as jest.Mock).mockResolvedValue({
        id: 'payment-4',
        orderId: 'order-4',
        razorpayOrderId: 'order_rzp_4',
        status: PaymentStatus.INITIATED,
      });

      (prisma.payment.update as jest.Mock).mockResolvedValue({
        id: 'payment-4',
        orderId: 'order-4',
        status: PaymentStatus.FAILED,
      });

      (prisma.order.findUnique as jest.Mock).mockResolvedValue({
        id: 'order-4',
        buyerId: 'buyer-4',
      });

      await service.handleWebhook(Buffer.from(body), signature);

      expect(notificationsService.create).toHaveBeenCalledWith({
        userId: 'buyer-4',
        type: NotificationType.PAYMENT_FAILED,
        title: 'Payment failed',
        message: expect.stringContaining('order-4'),
        metadata: expect.objectContaining({ orderId: 'order-4', paymentId: 'payment-4' }),
      });
    });

    it('returns ack when raw body is null/undefined', async () => {
      const result = await service.handleWebhook(null);
      expect(result).toEqual({ received: true });
      expect(prisma.payment.update).not.toHaveBeenCalled();
    });

    it('returns ack when webhook secret is not configured', async () => {
      (configService.get as jest.Mock).mockReturnValue(undefined);
      // Recreate service so the uncached config path is hit
      const freshService = new PaymentsService(prisma, configService, notificationsService);

      const body = buildWebhookBody('payment.captured', 'order_rzp_5');
      const result = await freshService.handleWebhook(Buffer.from(body), 'some-sig');

      expect(result).toEqual({ received: true });
      expect(prisma.payment.update).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException when signature header is missing', async () => {
      const body = buildWebhookBody('payment.captured', 'order_rzp_no_sig');

      await expect(
        service.handleWebhook(Buffer.from(body), undefined),
      ).rejects.toThrow('Missing Razorpay signature');
    });

    it('returns ack when webhook body is malformed JSON', async () => {
      const malformedBody = '{"event":"payment.captured"';
      const signature = generateSignature(malformedBody, WEBHOOK_SECRET);

      const result = await service.handleWebhook(
        Buffer.from(malformedBody),
        signature,
      );

      expect(result).toEqual({ received: true });
    });

    it('returns ack when order lookup fails during success notification fanout', async () => {
      const body = buildWebhookBody('payment.captured', 'order_rzp_notify_missing');
      const signature = generateSignature(body, WEBHOOK_SECRET);

      (prisma.payment.findUnique as jest.Mock).mockResolvedValue({
        id: 'payment-notify-missing',
        orderId: 'order-missing',
        razorpayOrderId: 'order_rzp_notify_missing',
        status: PaymentStatus.INITIATED,
        razorpayPaymentId: null,
      });
      (prisma.payment.update as jest.Mock).mockResolvedValue({
        id: 'payment-notify-missing',
        orderId: 'order-missing',
        status: PaymentStatus.SUCCESS,
      });
      (prisma.order.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.handleWebhook(Buffer.from(body), signature);

      expect(result).toEqual({ received: true });
      expect(notificationsService.create).not.toHaveBeenCalled();
    });

    it('continues when buyer and vendor notification dispatch throws for payment.captured', async () => {
      const body = buildWebhookBody('payment.captured', 'order_rzp_notify_fail', 'pay_notify_fail');
      const signature = generateSignature(body, WEBHOOK_SECRET);

      (prisma.payment.findUnique as jest.Mock).mockResolvedValue({
        id: 'payment-notify-fail',
        orderId: 'order-notify-fail',
        razorpayOrderId: 'order_rzp_notify_fail',
        status: PaymentStatus.INITIATED,
        razorpayPaymentId: null,
      });
      (prisma.payment.update as jest.Mock).mockResolvedValue({
        id: 'payment-notify-fail',
        orderId: 'order-notify-fail',
        status: PaymentStatus.SUCCESS,
      });
      (prisma.order.findUnique as jest.Mock).mockResolvedValue({
        id: 'order-notify-fail',
        buyerId: 'buyer-notify-fail',
        vendorId: 'vendor-profile-1',
        referenceCode: null,
        vendor: {
          userId: 'vendor-user-1',
        },
      });

      (notificationsService.create as jest.Mock)
        .mockRejectedValueOnce(new Error('buyer notification failed'))
        .mockRejectedValueOnce(new Error('vendor notification failed'));

      const result = await service.handleWebhook(Buffer.from(body), signature);

      expect(result).toEqual({ received: true });
      expect(notificationsService.create).toHaveBeenCalledTimes(2);
    });

    it('continues when buyer and vendor notification dispatch throws for payment.failed', async () => {
      const body = JSON.stringify({
        event: 'payment.failed',
        payload: {
          payment: {
            entity: {
              id: 'pay_fail_notify',
              order_id: 'order_rzp_fail_notify',
              error: {
                description: 'Gateway timeout',
              },
            },
          },
        },
      });
      const signature = generateSignature(body, WEBHOOK_SECRET);

      (prisma.payment.findUnique as jest.Mock).mockResolvedValue({
        id: 'payment-fail-notify',
        orderId: 'order-fail-notify',
        razorpayOrderId: 'order_rzp_fail_notify',
        status: PaymentStatus.INITIATED,
      });
      (prisma.payment.update as jest.Mock).mockResolvedValue({
        id: 'payment-fail-notify',
        orderId: 'order-fail-notify',
        status: PaymentStatus.FAILED,
      });
      (prisma.order.findUnique as jest.Mock).mockResolvedValue({
        id: 'order-fail-notify',
        buyerId: 'buyer-fail-notify',
        vendorId: 'vendor-profile-2',
        referenceCode: null,
        vendor: {
          userId: 'vendor-user-2',
        },
      });

      (notificationsService.create as jest.Mock)
        .mockRejectedValueOnce(new Error('buyer fail notification failed'))
        .mockRejectedValueOnce(new Error('vendor fail notification failed'));

      const result = await service.handleWebhook(Buffer.from(body), signature);

      expect(result).toEqual({ received: true });
      expect(notificationsService.create).toHaveBeenCalledTimes(2);
    });
  });
});
