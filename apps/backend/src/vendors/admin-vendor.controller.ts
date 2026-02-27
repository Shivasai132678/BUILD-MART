import { Controller, Param, Patch, Req, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { Request } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { VendorService } from './vendor.service';

type AuthenticatedRequest = Request & {
  user?: {
    id?: string;
    sub?: string;
  };
};

@Controller({
  path: 'admin/vendors',
  version: '1',
})
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminVendorController {
  constructor(private readonly vendorService: VendorService) {}

  @Patch(':id/approve')
  @Roles(UserRole.ADMIN)
  approveVendor(
    @Param('id') vendorId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    const adminUserId = request.user?.id ?? request.user?.sub;
    return this.vendorService.approveVendor(vendorId, adminUserId);
  }
}
