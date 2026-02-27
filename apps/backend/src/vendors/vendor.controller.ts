import {
  Body,
  Controller,
  Get,
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
  @Roles(UserRole.BUYER)
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

  private getAuthenticatedUserId(request: AuthenticatedRequest): string {
    const userId = request.user?.sub;
    if (!userId) {
      throw new UnauthorizedException('Authenticated user context is missing');
    }
    return userId;
  }
}
