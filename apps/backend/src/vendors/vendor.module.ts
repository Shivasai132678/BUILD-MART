import { Module } from '@nestjs/common';
import { RolesGuard } from '../auth/guards/roles.guard';
import { FilesModule } from '../files/files.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminVendorController } from './admin-vendor.controller';
import { VendorController } from './vendor.controller';
import { VendorService } from './vendor.service';

@Module({
  imports: [PrismaModule, FilesModule],
  controllers: [VendorController, AdminVendorController],
  providers: [VendorService, RolesGuard],
  exports: [VendorService],
})
export class VendorModule {}
