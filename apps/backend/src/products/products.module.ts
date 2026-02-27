import { Module } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { CategoriesController, ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  imports: [PrismaModule],
  controllers: [CategoriesController, ProductsController],
  providers: [ProductsService, JwtAuthGuard, RolesGuard],
  exports: [ProductsService],
})
export class ProductsModule {}
