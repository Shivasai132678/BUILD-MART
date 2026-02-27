import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { Request } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreatePaymentOrderDto } from './dto/create-payment-order.dto';
import { PaymentsService } from './payments.service';

type AuthenticatedRequest = Request & {
  user?: {
    sub?: string;
    role?: UserRole;
  };
  rawBody?: Buffer;
  body?: unknown;
};

function getRequestUser(request: AuthenticatedRequest): { userId: string; role: UserRole } {
  const userId = request.user?.sub;
  const role = request.user?.role;

  if (!userId || !role) {
    throw new UnauthorizedException('Authenticated user context is missing');
  }

  return { userId, role };
}

@Controller({
  path: 'payments',
  version: '1',
})
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('create-order')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.BUYER)
  createPaymentOrder(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreatePaymentOrderDto,
  ) {
    const { userId } = getRequestUser(request);
    return this.paymentsService.createPaymentOrder(userId, dto);
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  handleWebhook(
    @Req() request: AuthenticatedRequest,
    @Headers('x-razorpay-signature') razorpaySignature?: string,
  ) {
    return this.paymentsService.handleWebhook(
      request.rawBody ?? request.body,
      razorpaySignature,
    );
  }
}
