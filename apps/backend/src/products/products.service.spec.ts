import { NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import { ProductsService } from './products.service';

describe('ProductsService', () => {
  let service: ProductsService;

  const prisma = {
    category: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    product: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    $transaction: jest.fn(),
  } as unknown as jest.Mocked<PrismaService>;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ProductsService(prisma);
  });

  it('creates category with optional fields', async () => {
    const created = { id: 'cat-1', name: 'Cement', slug: 'cement' };
    (prisma.category.create as jest.Mock).mockResolvedValue(created);

    const result = await service.createCategory({
      name: 'Cement',
      slug: 'cement',
      description: 'All cement products',
      imageUrl: 'https://example.com/cement.png',
      isActive: true,
    });

    expect(result).toEqual(created);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(prisma.category.create).toHaveBeenCalledWith({
      data: {
        name: 'Cement',
        slug: 'cement',
        description: 'All cement products',
        imageUrl: 'https://example.com/cement.png',
        isActive: true,
      },
    });
  });

  it('updates category when category exists', async () => {
    (prisma.category.findUnique as jest.Mock).mockResolvedValue({ id: 'cat-1' });
    (prisma.category.update as jest.Mock).mockResolvedValue({ id: 'cat-1', name: 'Steel' });

    const result = await service.updateCategory('cat-1', { name: 'Steel' });

    expect(result).toEqual({ id: 'cat-1', name: 'Steel' });
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(prisma.category.update).toHaveBeenCalledWith({
      where: { id: 'cat-1' },
      data: { name: 'Steel' },
    });
  });

  it('throws on updateCategory when category does not exist', async () => {
    (prisma.category.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(service.updateCategory('missing', { name: 'Steel' })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('deletes category when category exists', async () => {
    (prisma.category.findUnique as jest.Mock).mockResolvedValue({ id: 'cat-1' });
    (prisma.category.delete as jest.Mock).mockResolvedValue({ id: 'cat-1' });

    const result = await service.deleteCategory('cat-1');
    expect(result).toEqual({ id: 'cat-1' });
  });

  it('lists categories with pagination metadata', async () => {
    const items = [{ id: 'cat-1' }];
    (prisma.$transaction as jest.Mock).mockResolvedValue([items, 1]);

    const result = await service.listCategories(10, 5);

    expect(result).toEqual({ items, total: 1, limit: 10, offset: 5 });
  });

  it('throws when category is not found by id', async () => {
    (prisma.category.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(service.getCategory('missing')).rejects.toThrow(NotFoundException);
  });

  it('creates product after ensuring category exists', async () => {
    (prisma.category.findUnique as jest.Mock).mockResolvedValue({ id: 'cat-1' });
    (prisma.product.create as jest.Mock).mockResolvedValue({ id: 'prod-1' });

    const result = await service.createProduct({
      categoryId: 'cat-1',
      name: 'OPC 53',
      unit: 'bag',
      basePrice: '420.00',
      description: 'Premium cement',
      imageUrl: 'https://example.com/opc53.png',
      isActive: true,
    });

    expect(result).toEqual({ id: 'prod-1' });
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(prisma.product.create).toHaveBeenCalledWith({
      data: {
        categoryId: 'cat-1',
        name: 'OPC 53',
        unit: 'bag',
        basePrice: '420.00',
        description: 'Premium cement',
        imageUrl: 'https://example.com/opc53.png',
        isActive: true,
      },
    });
  });

  it('updates product and validates new categoryId when provided', async () => {
    (prisma.product.findUnique as jest.Mock).mockResolvedValue({ id: 'prod-1' });
    (prisma.category.findUnique as jest.Mock).mockResolvedValue({ id: 'cat-2' });
    (prisma.product.update as jest.Mock).mockResolvedValue({ id: 'prod-1', categoryId: 'cat-2' });

    const result = await service.updateProduct('prod-1', { categoryId: 'cat-2' });

    expect(result).toEqual({ id: 'prod-1', categoryId: 'cat-2' });
  });

  it('soft deletes product and sets deletedAt', async () => {
    (prisma.product.findUnique as jest.Mock).mockResolvedValue({ id: 'prod-1', deletedAt: null });
    (prisma.product.update as jest.Mock).mockResolvedValue({
      id: 'prod-1',
      deletedAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    const result = await service.deleteProduct('prod-1');

    expect(result.id).toBe('prod-1');
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(prisma.product.update).toHaveBeenCalledWith({
      where: { id: 'prod-1' },
      data: { deletedAt: expect.any(Date) },
    });
  });

  it('throws when deleting product already soft deleted', async () => {
    (prisma.product.findUnique as jest.Mock).mockResolvedValue({
      id: 'prod-1',
      deletedAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    await expect(service.deleteProduct('prod-1')).rejects.toThrow(NotFoundException);
  });

  it('lists products with default active and deleted filters, category and search', async () => {
    const items = [{ id: 'prod-1' }];
    (prisma.$transaction as jest.Mock).mockResolvedValue([items, 1]);

    const result = await service.listProducts(20, 0, 'cat-1', '  opc  ');

    expect(result).toEqual({ items, total: 1, limit: 20, offset: 0 });

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(prisma.product.findMany).toHaveBeenCalledWith({
      where: {
        deletedAt: null,
        isActive: true,
        categoryId: 'cat-1',
        name: {
          contains: 'opc',
          mode: 'insensitive',
        },
      },
      skip: 0,
      take: 20,
      orderBy: { createdAt: 'desc' },
    });
  });

  it('gets active non-deleted product by id', async () => {
    (prisma.product.findFirst as jest.Mock).mockResolvedValue({ id: 'prod-1' });

    const result = await service.getProduct('prod-1');
    expect(result).toEqual({ id: 'prod-1' });
  });

  it('throws when product is missing in getProduct', async () => {
    (prisma.product.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(service.getProduct('missing')).rejects.toThrow(NotFoundException);
  });
});
