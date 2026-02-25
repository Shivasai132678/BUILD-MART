import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { VendorService } from './vendor.service';

@Module({
  imports: [PrismaModule],
  providers: [VendorService],
  exports: [VendorService],
})
export class VendorModule {}
