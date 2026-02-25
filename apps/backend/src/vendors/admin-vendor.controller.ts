import { Controller, Param, Patch, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { VendorService } from './vendor.service';

@Controller({
  path: 'admin/vendors',
  version: '1',
})
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminVendorController {
  constructor(private readonly vendorService: VendorService) {}

  @Patch(':id/approve')
  @Roles(UserRole.ADMIN)
  approveVendor(@Param('id') vendorId: string) {
    return this.vendorService.approveVendor(vendorId);
  }
}
