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
import { OrderStatus, UserRole, VendorStatus } from '@prisma/client';
import type { Request } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { FlagOrderDto } from './dto/flag-order.dto';
import { BulkVendorActionDto } from './dto/bulk-vendor-action.dto';
import { AdminService } from './admin.service';

type AuthenticatedRequest = Request & {
  user?: { sub?: string; role?: UserRole };
};

function getAdminUserId(request: AuthenticatedRequest): string {
  const userId = request.user?.sub;
  if (!userId) throw new UnauthorizedException('Authenticated user context is missing');
  return userId;
}

@Controller({
  path: 'admin',
  version: '1',
})
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('metrics')
  @Roles(UserRole.ADMIN)
  getMetrics() {
    return this.adminService.getMetrics();
  }

  @Get('vendors/pending')
  @Roles(UserRole.ADMIN)
  getPendingVendors(
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
  ) {
    return this.adminService.getPendingVendors(limit, offset);
  }

  @Get('orders')
  @Roles(UserRole.ADMIN)
  listAllOrders(
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
    @Query('status', new ParseEnumPipe(OrderStatus, { optional: true }))
    status?: OrderStatus,
  ) {
    return this.adminService.listAllOrders(limit, offset, status);
  }

  @Get('orders/:id')
  @Roles(UserRole.ADMIN)
  getOrderById(@Param('id') id: string) {
    return this.adminService.getOrderById(id);
  }

  @Get('users')
  @Roles(UserRole.ADMIN)
  getAllUsers(
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
  ) {
    return this.adminService.getAllUsers(limit, offset);
  }

  @Get('vendors')
  @Roles(UserRole.ADMIN)
  getAllVendors(
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
    @Query('status', new ParseEnumPipe(VendorStatus, { optional: true }))
    status?: VendorStatus,
  ) {
    return this.adminService.getAllVendors(limit, offset, status);
  }

  @Get('rfqs')
  @Roles(UserRole.ADMIN)
  getAllRfqs(
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
  ) {
    return this.adminService.getAllRfqs(limit, offset);
  }

  @Post('orders/:id/cancel')
  @Roles(UserRole.ADMIN)
  forceCancelOrder(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    const adminUserId = getAdminUserId(request);
    return this.adminService.forceCancelOrder(id, adminUserId);
  }

  @Patch('orders/:id/flag')
  @Roles(UserRole.ADMIN)
  flagOrder(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
    @Body() body: FlagOrderDto,
  ) {
    const adminUserId = getAdminUserId(request);
    return this.adminService.flagOrder(id, adminUserId, body.reason);
  }

  @Post('vendors/bulk-approve')
  @Roles(UserRole.ADMIN)
  bulkApproveVendors(
    @Req() request: AuthenticatedRequest,
    @Body() body: BulkVendorActionDto,
  ) {
    const adminUserId = getAdminUserId(request);
    return this.adminService.bulkApproveVendors(body.vendorIds, adminUserId);
  }

  @Post('vendors/bulk-suspend')
  @Roles(UserRole.ADMIN)
  bulkSuspendVendors(
    @Req() request: AuthenticatedRequest,
    @Body() body: BulkVendorActionDto,
  ) {
    const adminUserId = getAdminUserId(request);
    return this.adminService.bulkSuspendVendors(body.vendorIds, adminUserId);
  }
}
