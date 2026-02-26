import { Module } from '@nestjs/common';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { RfqController } from './rfq.controller';
import { RfqService } from './rfq.service';

@Module({
  imports: [PrismaModule],
  controllers: [RfqController],
  providers: [RfqService, RolesGuard],
  exports: [RfqService],
})
export class RfqModule {}
