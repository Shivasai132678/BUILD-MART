import { Module } from '@nestjs/common';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { RolesGuard } from '../common/auth/roles.guard';
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
