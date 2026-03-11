import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '@prisma/client';
import { OnboardVendorDto } from './dto/onboard-vendor.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';
import { ManageVendorProductsDto } from './dto/manage-vendor-products.dto';
import { VendorService } from './vendor.service';

type AuthenticatedRequest = Request & {
  user?: {
    sub?: string;
    role?: UserRole;
  };
};

@Controller({
  path: 'vendors',
  version: '1',
})
@UseGuards(JwtAuthGuard, RolesGuard)
export class VendorController {
  constructor(private readonly vendorService: VendorService) {}

  @Post('onboard')
  @Roles(UserRole.BUYER, UserRole.PENDING)
  onboard(
    @Req() request: AuthenticatedRequest,
    @Body() dto: OnboardVendorDto,
  ) {
    const userId = this.getAuthenticatedUserId(request);
    return this.vendorService.onboard(userId, dto);
  }

  @Get('profile')
  @Roles(UserRole.VENDOR, UserRole.BUYER)
  getProfile(@Req() request: AuthenticatedRequest) {
    const userId = this.getAuthenticatedUserId(request);
    return this.vendorService.getProfile(userId);
  }

  @Patch('profile')
  @Roles(UserRole.VENDOR)
  updateProfile(
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateVendorDto,
  ) {
    const userId = this.getAuthenticatedUserId(request);
    return this.vendorService.updateProfile(userId, dto);
  }

  @Get('products')
  @Roles(UserRole.VENDOR)
  getVendorProducts(@Req() request: AuthenticatedRequest) {
    const userId = this.getAuthenticatedUserId(request);
    return this.vendorService.getVendorProducts(userId);
  }

  @Post('products')
  @Roles(UserRole.VENDOR)
  addVendorProducts(
    @Req() request: AuthenticatedRequest,
    @Body() dto: ManageVendorProductsDto,
  ) {
    const userId = this.getAuthenticatedUserId(request);
    return this.vendorService.addVendorProducts(userId, dto.productIds);
  }

  @Delete('products/:productId')
  @Roles(UserRole.VENDOR)
  removeVendorProduct(
    @Req() request: AuthenticatedRequest,
    @Param('productId') productId: string,
  ) {
    const userId = this.getAuthenticatedUserId(request);
    return this.vendorService.removeVendorProduct(userId, productId);
  }

  private getAuthenticatedUserId(request: AuthenticatedRequest): string {
    const userId = request.user?.sub;
    if (!userId) {
      throw new UnauthorizedException('Authenticated user context is missing');
    }
    return userId;
  }
}
