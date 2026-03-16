import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseEnumPipe,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { OrderStatus, UserRole } from '@prisma/client';
import type { Request, Response } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateOrderDto } from './dto/create-order.dto';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { CancelOrderDto } from './dto/cancel-order.dto';
import { CreateDirectOrderDto } from './dto/create-direct-order.dto';
import { InvoiceService } from './invoice.service';
import { OrdersService } from './orders.service';

type AuthenticatedRequest = Request & {
  user?: {
    sub?: string;
    role?: UserRole;
  };
};

function getRequestUser(request: AuthenticatedRequest): {
  userId: string;
  role: UserRole;
} {
  const userId = request.user?.sub;
  const role = request.user?.role;

  if (!userId || !role) {
    throw new UnauthorizedException('Authenticated user context is missing');
  }

  return { userId, role };
}

@Controller({
  path: 'orders',
  version: '1',
})
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly invoiceService: InvoiceService,
  ) {}

  @Post('direct')
  @Roles(UserRole.BUYER)
  createDirectOrder(@Req() request: AuthenticatedRequest, @Body() dto: CreateDirectOrderDto) {
    const { userId } = getRequestUser(request);
    return this.ordersService.createDirectOrder(userId, dto);
  }

  @Post()
  @Roles(UserRole.BUYER)
  createOrder(@Req() request: AuthenticatedRequest, @Body() dto: CreateOrderDto) {
    const { userId } = getRequestUser(request);
    return this.ordersService.createOrder(userId, dto);
  }

  @Get()
  @Roles(UserRole.BUYER, UserRole.VENDOR)
  listOrders(
    @Req() request: AuthenticatedRequest,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
    @Query('status', new ParseEnumPipe(OrderStatus, { optional: true }))
    status?: OrderStatus,
  ) {
    const { userId, role } = getRequestUser(request);
    return this.ordersService.listOrders(userId, role, limit, offset, status);
  }

  @Get(':id')
  @Roles(UserRole.BUYER, UserRole.VENDOR)
  getOrder(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    const { userId, role } = getRequestUser(request);
    return this.ordersService.getOrder(id, userId, role);
  }

  @Patch(':id/status')
  @Roles(UserRole.VENDOR)
  updateOrderStatus(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    const { userId } = getRequestUser(request);
    return this.ordersService.updateOrderStatus(id, userId, dto);
  }

  @Post(':id/cancel')
  @Roles(UserRole.BUYER, UserRole.VENDOR)
  cancelOrder(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
    @Body() body: CancelOrderDto,
  ) {
    const { userId, role } = getRequestUser(request);
    return this.ordersService.cancelOrder(id, userId, role, body.cancelReason);
  }

  @Post(':id/review')
  @Roles(UserRole.BUYER)
  submitReview(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateReviewDto,
  ) {
    const { userId } = getRequestUser(request);
    return this.ordersService.submitReview(id, userId, dto);
  }

  @Get(':id/invoice')
  @Roles(UserRole.BUYER, UserRole.VENDOR)
  async downloadInvoice(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    const { userId, role } = getRequestUser(request);
    const buffer = await this.invoiceService.generateInvoice(id, userId, role);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="invoice-${id}.pdf"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }
}
