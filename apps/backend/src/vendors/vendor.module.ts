import { Module } from '@nestjs/common';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { VendorController } from './vendor.controller';
import { VendorService } from './vendor.service';

@Module({
  imports: [PrismaModule],
  controllers: [VendorController],
  providers: [VendorService, RolesGuard],
  exports: [VendorService],
})
export class VendorModule {}
