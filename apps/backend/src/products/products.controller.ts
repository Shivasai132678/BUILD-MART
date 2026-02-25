import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { Roles } from '../common/auth/roles.decorator';
import { RolesGuard } from '../common/auth/roles.guard';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductsService } from './products.service';

const READ_ROLES: UserRole[] = [UserRole.ADMIN, UserRole.BUYER, UserRole.VENDOR];

@Controller({
  path: 'categories',
  version: '1',
})
@UseGuards(JwtAuthGuard, RolesGuard)
export class CategoriesController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @Roles(...READ_ROLES)
  listCategories(
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
  ) {
    return this.productsService.listCategories(limit, offset);
  }

  @Get(':id')
  @Roles(...READ_ROLES)
  getCategory(@Param('id') id: string) {
    return this.productsService.getCategory(id);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.productsService.createCategory(dto);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  updateCategory(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.productsService.updateCategory(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  deleteCategory(@Param('id') id: string) {
    return this.productsService.deleteCategory(id);
  }
}

@Controller({
  path: 'products',
  version: '1',
})
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @Roles(...READ_ROLES)
  listProducts(
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
    @Query('categoryId') categoryId?: string,
  ) {
    return this.productsService.listProducts(limit, offset, categoryId);
  }

  @Get(':id')
  @Roles(...READ_ROLES)
  getProduct(@Param('id') id: string) {
    return this.productsService.getProduct(id);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  createProduct(@Body() dto: CreateProductDto) {
    return this.productsService.createProduct(dto);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  updateProduct(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.productsService.updateProduct(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  deleteProduct(@Param('id') id: string) {
    return this.productsService.deleteProduct(id);
  }
}
