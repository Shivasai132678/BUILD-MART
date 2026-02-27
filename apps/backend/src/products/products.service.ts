import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Category, Prisma, Product } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { UpdateProductDto } from './dto/update-product.dto';

type PaginatedCategories = {
  items: Category[];
  total: number;
  limit: number;
  offset: number;
};

type PaginatedProducts = {
  items: Product[];
  total: number;
  limit: number;
  offset: number;
};

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createCategory(dto: CreateCategoryDto): Promise<Category> {
    const category = await this.prisma.category.create({
      data: this.buildCreateCategoryData(dto),
    });

    this.logger.log(`Category created id=${category.id}`);
    return category;
  }

  async updateCategory(id: string, dto: UpdateCategoryDto): Promise<Category> {
    await this.ensureCategoryExists(id);

    const category = await this.prisma.category.update({
      where: { id },
      data: this.buildUpdateCategoryData(dto),
    });

    this.logger.log(`Category updated id=${id}`);
    return category;
  }

  async deleteCategory(id: string): Promise<Category> {
    await this.ensureCategoryExists(id);

    const category = await this.prisma.category.delete({
      where: { id },
    });

    this.logger.log(`Category deleted id=${id}`);
    return category;
  }

  async listCategories(limit: number, offset: number): Promise<PaginatedCategories> {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.category.findMany({
        skip: offset,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.category.count(),
    ]);

    return { items, total, limit, offset };
  }

  async getCategory(id: string): Promise<Category> {
    const category = await this.prisma.category.findUnique({
      where: { id },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return category;
  }

  async createProduct(dto: CreateProductDto): Promise<Product> {
    await this.ensureCategoryExists(dto.categoryId);

    const product = await this.prisma.product.create({
      data: this.buildCreateProductData(dto),
    });

    this.logger.log(`Product created id=${product.id}`);
    return product;
  }

  async updateProduct(id: string, dto: UpdateProductDto): Promise<Product> {
    await this.ensureProductExists(id);

    if (dto.categoryId) {
      await this.ensureCategoryExists(dto.categoryId);
    }

    const product = await this.prisma.product.update({
      where: { id },
      data: this.buildUpdateProductData(dto),
    });

    this.logger.log(`Product updated id=${id}`);
    return product;
  }

  async deleteProduct(id: string): Promise<Product> {
    const existing = await this.ensureProductExists(id);

    if (existing.deletedAt) {
      throw new NotFoundException('Product not found');
    }

    const product = await this.prisma.product.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    this.logger.log(`Product soft-deleted id=${id}`);
    return product;
  }

  async listProducts(
    limit: number,
    offset: number,
    categoryId?: string,
  ): Promise<PaginatedProducts> {
    const where: Prisma.ProductWhereInput = {
      deletedAt: null,
    };

    if (categoryId) {
      where.categoryId = categoryId;
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.product.count({ where }),
    ]);

    return { items, total, limit, offset };
  }

  async getProduct(id: string): Promise<Product> {
    const product = await this.prisma.product.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  private async ensureCategoryExists(id: string): Promise<Category> {
    const category = await this.prisma.category.findUnique({
      where: { id },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return category;
  }

  private async ensureProductExists(id: string): Promise<Product> {
    const product = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  private buildCreateCategoryData(
    dto: CreateCategoryDto,
  ): Prisma.CategoryCreateInput {
    const data: Prisma.CategoryCreateInput = {
      name: dto.name,
      slug: dto.slug,
    };

    if (dto.description !== undefined) {
      data.description = dto.description;
    }
    if (dto.imageUrl !== undefined) {
      data.imageUrl = dto.imageUrl;
    }
    if (dto.isActive !== undefined) {
      data.isActive = dto.isActive;
    }

    return data;
  }

  private buildUpdateCategoryData(
    dto: UpdateCategoryDto,
  ): Prisma.CategoryUpdateInput {
    const data: Prisma.CategoryUpdateInput = {};

    if (dto.name !== undefined) {
      data.name = dto.name;
    }
    if (dto.slug !== undefined) {
      data.slug = dto.slug;
    }
    if (dto.description !== undefined) {
      data.description = dto.description;
    }
    if (dto.imageUrl !== undefined) {
      data.imageUrl = dto.imageUrl;
    }
    if (dto.isActive !== undefined) {
      data.isActive = dto.isActive;
    }

    return data;
  }

  private buildCreateProductData(
    dto: CreateProductDto,
  ): Prisma.ProductUncheckedCreateInput {
    const data: Prisma.ProductUncheckedCreateInput = {
      categoryId: dto.categoryId,
      name: dto.name,
      unit: dto.unit,
      basePrice: dto.basePrice,
    };

    if (dto.description !== undefined) {
      data.description = dto.description;
    }
    if (dto.imageUrl !== undefined) {
      data.imageUrl = dto.imageUrl;
    }
    if (dto.isActive !== undefined) {
      data.isActive = dto.isActive;
    }

    return data;
  }

  private buildUpdateProductData(
    dto: UpdateProductDto,
  ): Prisma.ProductUncheckedUpdateInput {
    const data: Prisma.ProductUncheckedUpdateInput = {};

    if (dto.categoryId !== undefined) {
      data.categoryId = dto.categoryId;
    }
    if (dto.name !== undefined) {
      data.name = dto.name;
    }
    if (dto.description !== undefined) {
      data.description = dto.description;
    }
    if (dto.unit !== undefined) {
      data.unit = dto.unit;
    }
    if (dto.basePrice !== undefined) {
      data.basePrice = dto.basePrice;
    }
    if (dto.imageUrl !== undefined) {
      data.imageUrl = dto.imageUrl;
    }
    if (dto.isActive !== undefined) {
      data.isActive = dto.isActive;
    }

    return data;
  }
}
