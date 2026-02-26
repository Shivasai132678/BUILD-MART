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
import { PaymentStatus } from '@prisma/client';
import { Prisma } from '@prisma/client';
import Razorpay from 'razorpay';
import { createHmac, timingSafeEqual } from 'node:crypto';
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
  ) {}

  async createPaymentOrder(
    buyerId: string,
    dto: CreatePaymentOrderDto,
  ): Promise<CreatePaymentOrderResponse> {
    const order = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
      include: {
        payment: true,
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
        await this.prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.SUCCESS,
            razorpayPaymentId: paymentEntity?.id ?? payment.razorpayPaymentId ?? null,
            webhookVerified: true,
            failureReason: null,
          },
        });

        this.logger.log(`Payment marked SUCCESS for orderId=${payment.orderId}`);
        return ack;
      }

      if (event.event === 'payment.failed') {
        await this.prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.FAILED,
            webhookVerified: true,
            failureReason: this.extractFailureReason(paymentEntity),
          },
        });

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
      // TODO: verify Razorpay sandbox credentials — see ENV.md
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
      // TODO: verify Razorpay sandbox credentials — see ENV.md
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
}
