import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../common/constants/status.enums';
import { OnboardVendorDto } from './dto/onboard-vendor.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';
import { VendorService } from './vendor.service';

type AuthenticatedRequest = Request & {
  user: {
    id: string;
    role: UserRole;
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
    return this.vendorService.onboard(request.user.id, dto);
  }

  @Get('profile')
  @Roles(UserRole.VENDOR, UserRole.BUYER)
  getProfile(@Req() request: AuthenticatedRequest) {
    return this.vendorService.getProfile(request.user.id);
  }

  @Patch('profile')
  @Roles(UserRole.VENDOR)
  updateProfile(
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateVendorDto,
  ) {
    return this.vendorService.updateProfile(request.user.id, dto);
  }
}
