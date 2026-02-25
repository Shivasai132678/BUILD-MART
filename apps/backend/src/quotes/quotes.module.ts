import { Module } from '@nestjs/common';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { QuotesController } from './quotes.controller';
import { QuotesService } from './quotes.service';

@Module({
  imports: [PrismaModule],
  controllers: [QuotesController],
  providers: [QuotesService, RolesGuard],
  exports: [QuotesService],
})
export class QuotesModule {}
