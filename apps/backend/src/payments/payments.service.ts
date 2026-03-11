import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationType, PaymentStatus } from '@prisma/client';
import { Prisma } from '@prisma/client';
import Razorpay from 'razorpay';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaymentOrderDto } from './dto/create-payment-order.dto';

type CreatePaymentOrderResponse = {
  razorpayOrderId: string;
  amount: number;
  currency: 'INR';
  key: string;
};

type WebhookAckResponse = {
  received: true;
};

type RazorpayCreateOrderResult = {
  id: string;
  amount: number;
  currency: string;
};

type RazorpayWebhookEvent = {
  event?: string;
  payload?: {
    payment?: {
      entity?: {
        id?: string;
        order_id?: string;
        error_description?: string;
        error?: {
          description?: string;
          reason?: string;
        };
      };
    };
  };
};

type RazorpayWebhookPaymentEntity = {
  id?: string;
  order_id?: string;
  error_description?: string;
  error?: {
    description?: string;
    reason?: string;
  };
};

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private razorpayClient: Razorpay | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async createPaymentOrder(
    buyerId: string,
    dto: CreatePaymentOrderDto,
  ): Promise<CreatePaymentOrderResponse> {
    const order = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
      include: {
        payment: true,
        vendor: { select: { userId: true } },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.buyerId !== buyerId) {
      throw new ForbiddenException('You are not allowed to create payment for this order');
    }

    if (order.status !== 'CONFIRMED') {
      throw new BadRequestException('Payment can only be created for CONFIRMED orders');
    }

    if (order.payment?.status === PaymentStatus.SUCCESS) {
      throw new ConflictException('Payment already completed for this order');
    }

    const razorpay = this.getRazorpayClientOrThrow();
    const amountInPaise = this.toPaise(order.totalAmount);
    const currency = 'INR' as const;

    const createdOrder = (await razorpay.orders.create({
      amount: amountInPaise,
      currency,
      receipt: order.id,
    })) as unknown as RazorpayCreateOrderResult;

    await this.prisma.payment.upsert({
      where: { orderId: order.id },
      create: {
        orderId: order.id,
        razorpayOrderId: createdOrder.id,
        amount: order.totalAmount,
        status: PaymentStatus.INITIATED,
      },
      update: {
        razorpayOrderId: createdOrder.id,
        amount: order.totalAmount,
        status: PaymentStatus.INITIATED,
        webhookVerified: false,
        failureReason: null,
      },
    });

    this.logger.log(`Razorpay order created for orderId=${order.id}`);

    if (order.vendor?.userId) {
      const orderRef = order.referenceCode ?? `#${order.id.slice(0, 8)}`;
      this.notificationsService
        .create({
          userId: order.vendor.userId,
          type: NotificationType.PAYMENT_INITIATED,
          title: 'Payment initiated',
          message: `The buyer has initiated payment for order ${orderRef}.`,
          metadata: { orderId: order.id },
        })
        .catch((err: unknown) => {
          const message = err instanceof Error ? err.message : 'Unknown error';
          this.logger.error(
            `Failed to send PAYMENT_INITIATED notification for orderId=${order.id}: ${message}`,
          );
        });
    }

    return {
      razorpayOrderId: createdOrder.id,
      amount: createdOrder.amount,
      currency,
      key: this.getRazorpayKeyIdOrThrow(),
    };
  }

  async handleWebhook(
    rawBody: unknown,
    razorpaySignature?: string,
  ): Promise<WebhookAckResponse> {
    const ack: WebhookAckResponse = { received: true };

    try {
      const bodyBuffer = this.normalizeRawBody(rawBody);

      if (!bodyBuffer) {
        this.logger.warn('Razorpay webhook received without raw body');
        return ack;
      }

      const webhookSecret = this.configService.get<string>('RAZORPAY_WEBHOOK_SECRET');

      if (!webhookSecret) {
        this.logger.error('RAZORPAY_WEBHOOK_SECRET is not configured');
        return ack;
      }

      this.assertValidWebhookSignature(bodyBuffer, razorpaySignature, webhookSecret);

      const event = this.parseWebhookEvent(bodyBuffer);
      const paymentEntity = event.payload?.payment?.entity;
      const razorpayOrderId = paymentEntity?.order_id;

      if (!razorpayOrderId) {
        this.logger.warn('Razorpay webhook missing payment.entity.order_id');
        return ack;
      }

      const payment = await this.prisma.payment.findUnique({
        where: { razorpayOrderId },
      });

      if (!payment) {
        this.logger.warn(`Payment not found for razorpayOrderId=${razorpayOrderId}`);
        return ack;
      }

      if (payment.status === PaymentStatus.SUCCESS) {
        this.logger.log(
          `Webhook idempotent skip for razorpayOrderId=${razorpayOrderId} (already SUCCESS)`,
        );
        return ack;
      }

      if (event.event === 'payment.captured') {
        const updatedPayment = await this.prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.SUCCESS,
            razorpayPaymentId: paymentEntity?.id ?? payment.razorpayPaymentId ?? null,
            webhookVerified: true,
            failureReason: null,
          },
        });

        await this.notifyBuyerForPaymentSuccess(payment.orderId, updatedPayment.id);

        this.logger.log(`Payment marked SUCCESS for orderId=${payment.orderId}`);
        return ack;
      }

      if (event.event === 'payment.failed') {
        const updatedPayment = await this.prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.FAILED,
            webhookVerified: true,
            failureReason: this.extractFailureReason(paymentEntity),
          },
        });

        await this.notifyBuyerForPaymentFailure(payment.orderId, updatedPayment.id);

        this.logger.warn(`Payment marked FAILED for orderId=${payment.orderId}`);
        return ack;
      }

      this.logger.log(`Unhandled Razorpay webhook event: ${event.event ?? 'unknown'}`);
      return ack;
    } catch (error: unknown) {
      if (error instanceof UnauthorizedException) {
        this.logger.warn(`Razorpay webhook signature verification failed: ${error.message}`);
        return ack;
      }

      if (error instanceof Error) {
        this.logger.error(`Razorpay webhook processing failed: ${error.message}`);
      } else {
        this.logger.error('Razorpay webhook processing failed with unknown error');
      }

      return ack;
    }
  }

  private getRazorpayClientOrThrow(): Razorpay {
    if (this.razorpayClient) {
      return this.razorpayClient;
    }

    const keyId = this.getRazorpayKeyIdOrThrow();
    const keySecret = this.configService.get<string>('RAZORPAY_KEY_SECRET');

    if (!keySecret) {
      throw new ServiceUnavailableException('Razorpay credentials are not configured');
    }

    this.razorpayClient = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });

    return this.razorpayClient;
  }

  private getRazorpayKeyIdOrThrow(): string {
    const keyId = this.configService.get<string>('RAZORPAY_KEY_ID');

    if (!keyId) {
      throw new ServiceUnavailableException('Razorpay credentials are not configured');
    }

    return keyId;
  }

  private toPaise(amount: Prisma.Decimal): number {
    return new Prisma.Decimal(amount).mul(100).toNumber();
  }

  private normalizeRawBody(rawBody: unknown): Buffer | null {
    if (Buffer.isBuffer(rawBody)) {
      return rawBody;
    }

    if (typeof rawBody === 'string') {
      return Buffer.from(rawBody);
    }

    return null;
  }

  private assertValidWebhookSignature(
    rawBody: Buffer,
    razorpaySignature: string | undefined,
    webhookSecret: string,
  ): void {
    if (!razorpaySignature) {
      throw new UnauthorizedException('Missing Razorpay signature');
    }

    const expectedSignature = createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
    const incomingBuffer = Buffer.from(razorpaySignature, 'utf8');

    if (expectedBuffer.length !== incomingBuffer.length) {
      throw new UnauthorizedException('Invalid Razorpay signature');
    }

    if (!timingSafeEqual(expectedBuffer, incomingBuffer)) {
      throw new UnauthorizedException('Invalid Razorpay signature');
    }
  }

  private parseWebhookEvent(rawBody: Buffer): RazorpayWebhookEvent {
    try {
      return JSON.parse(rawBody.toString('utf8')) as RazorpayWebhookEvent;
    } catch {
      throw new BadRequestException('Invalid Razorpay webhook payload');
    }
  }

  private extractFailureReason(paymentEntity: RazorpayWebhookPaymentEntity | undefined): string {
    return (
      paymentEntity?.error_description ??
      paymentEntity?.error?.description ??
      paymentEntity?.error?.reason ??
      'Payment failed'
    );
  }

  private async notifyBuyerForPaymentSuccess(
    orderId: string,
    paymentId: string,
  ): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        buyerId: true,
        vendorId: true,
        referenceCode: true,
        vendor: { select: { userId: true } },
      },
    });

    if (!order) {
      this.logger.warn(
        `Order not found while sending payment success notification orderId=${orderId}`,
      );
      return;
    }

    const orderRef = order.referenceCode ?? `#${order.id.slice(0, 8)}`;

    try {
      await this.notificationsService.create({
        userId: order.buyerId,
        type: NotificationType.PAYMENT_SUCCESS,
        title: 'Payment confirmed',
        message: `Your payment for order ${orderRef} was successful.`,
        metadata: { orderId: order.id, paymentId },
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Unknown notification error';
      this.logger.error(
        `Failed to send payment success notification for orderId=${order.id}: ${message}`,
      );
    }

    if (order.vendor?.userId) {
      try {
        await this.notificationsService.create({
          userId: order.vendor.userId,
          type: NotificationType.PAYMENT_SUCCESS,
          title: 'Payment received',
          message: `Payment for order ${orderRef} has been received.`,
          metadata: { orderId: order.id, paymentId },
        });
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : 'Unknown notification error';
        this.logger.error(
          `Failed to send vendor payment success notification for orderId=${order.id}: ${message}`,
        );
      }
    }
  }

  private async notifyBuyerForPaymentFailure(
    orderId: string,
    paymentId: string,
  ): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        buyerId: true,
        vendorId: true,
        referenceCode: true,
        vendor: { select: { userId: true } },
      },
    });

    if (!order) {
      this.logger.warn(
        `Order not found while sending payment failure notification orderId=${orderId}`,
      );
      return;
    }

    const orderRef = order.referenceCode ?? `#${order.id.slice(0, 8)}`;

    try {
      await this.notificationsService.create({
        userId: order.buyerId,
        type: NotificationType.PAYMENT_FAILED,
        title: 'Payment failed',
        message: `Your payment for order ${orderRef} failed. Please retry.`,
        metadata: { orderId: order.id, paymentId },
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Unknown notification error';
      this.logger.error(
        `Failed to send payment failure notification for orderId=${order.id}: ${message}`,
      );
    }

    if (order.vendor?.userId) {
      try {
        await this.notificationsService.create({
          userId: order.vendor.userId,
          type: NotificationType.PAYMENT_FAILED,
          title: 'Payment failed',
          message: `Payment for order ${orderRef} has failed. The buyer has been asked to retry.`,
          metadata: { orderId: order.id, paymentId },
        });
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : 'Unknown notification error';
        this.logger.error(
          `Failed to send vendor payment failure notification for orderId=${order.id}: ${message}`,
        );
      }
    }
  }
}
