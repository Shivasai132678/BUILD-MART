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
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { OrderStatus, UserRole } from '@prisma/client';
import type { Request } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { CancelOrderDto } from './dto/cancel-order.dto';
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
  constructor(private readonly ordersService: OrdersService) {}

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
}
