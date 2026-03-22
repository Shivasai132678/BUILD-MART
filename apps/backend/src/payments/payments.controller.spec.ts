import { UnauthorizedException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PaymentsController } from './payments.controller';
import type { PaymentsService } from './payments.service';

describe('PaymentsController', () => {
  const paymentsService = {
    createPaymentOrder: jest.fn(),
    handleWebhook: jest.fn(),
  } as unknown as jest.Mocked<PaymentsService>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delegates createPaymentOrder and webhook handlers', async () => {
    const controller = new PaymentsController(paymentsService);
    const req = { user: { sub: 'buyer-1', role: UserRole.BUYER } } as const;

    (paymentsService.createPaymentOrder as jest.Mock).mockResolvedValue({ id: 'pay-order-1' });
    (paymentsService.handleWebhook as jest.Mock).mockResolvedValue({ ok: true });

    await expect(controller.createPaymentOrder(req, { orderId: 'order-1' })).resolves.toEqual({
      id: 'pay-order-1',
    });
    await expect(
      controller.handleWebhook({ rawBody: Buffer.from('{"id":1}') } as never, 'sig-1'),
    ).resolves.toEqual({ ok: true });
    await expect(
      controller.handleWebhook({ body: { id: 1 } } as never, 'sig-2'),
    ).resolves.toEqual({ ok: true });
  });

  it('throws UnauthorizedException when authenticated user context is missing', async () => {
    const controller = new PaymentsController(paymentsService);

    expect(() => controller.createPaymentOrder({} as never, { orderId: 'order-1' })).toThrow(
      UnauthorizedException,
    );
  });
});
