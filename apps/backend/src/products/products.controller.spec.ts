import { CategoriesController, ProductsController } from './products.controller';
import type { ProductsService } from './products.service';

describe('ProductsController', () => {
  const productsService = {
    listCategories: jest.fn(),
    getCategory: jest.fn(),
    createCategory: jest.fn(),
    updateCategory: jest.fn(),
    deleteCategory: jest.fn(),
    listProducts: jest.fn(),
    getProduct: jest.fn(),
    createProduct: jest.fn(),
    updateProduct: jest.fn(),
    deleteProduct: jest.fn(),
  } as unknown as jest.Mocked<ProductsService>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delegates all category controller calls to service', async () => {
    const categoriesController = new CategoriesController(productsService);

    (productsService.listCategories as jest.Mock).mockResolvedValue({ items: [], total: 0 });
    (productsService.getCategory as jest.Mock).mockResolvedValue({ id: 'cat-1' });
    (productsService.createCategory as jest.Mock).mockResolvedValue({ id: 'cat-2' });
    (productsService.updateCategory as jest.Mock).mockResolvedValue({ id: 'cat-1', name: 'Steel' });
    (productsService.deleteCategory as jest.Mock).mockResolvedValue({ id: 'cat-1' });

    await expect(categoriesController.listCategories(20, 0)).resolves.toEqual({
      items: [],
      total: 0,
    });
    await expect(categoriesController.getCategory('cat-1')).resolves.toEqual({ id: 'cat-1' });
    await expect(
      categoriesController.createCategory({ name: 'Cement', slug: 'cement' }),
    ).resolves.toEqual({ id: 'cat-2' });
    await expect(categoriesController.updateCategory('cat-1', { name: 'Steel' })).resolves.toEqual({
      id: 'cat-1',
      name: 'Steel',
    });
    await expect(categoriesController.deleteCategory('cat-1')).resolves.toEqual({ id: 'cat-1' });
  });

  it('delegates all product controller calls to service', async () => {
    const controller = new ProductsController(productsService);

    (productsService.listProducts as jest.Mock).mockResolvedValue({ items: [], total: 0 });
    (productsService.getProduct as jest.Mock).mockResolvedValue({ id: 'prod-1' });
    (productsService.createProduct as jest.Mock).mockResolvedValue({ id: 'prod-2' });
    (productsService.updateProduct as jest.Mock).mockResolvedValue({ id: 'prod-1', name: 'Updated' });
    (productsService.deleteProduct as jest.Mock).mockResolvedValue({ id: 'prod-1' });

    await expect(controller.listProducts(20, 0, 'cat-1', 'opc')).resolves.toEqual({
      items: [],
      total: 0,
    });
    await expect(controller.getProduct('prod-1')).resolves.toEqual({ id: 'prod-1' });
    await expect(
      controller.createProduct({
        categoryId: 'cat-1',
        name: 'OPC 53',
        unit: 'bag',
        basePrice: '420.00',
      }),
    ).resolves.toEqual({ id: 'prod-2' });
    await expect(controller.updateProduct('prod-1', { name: 'Updated' })).resolves.toEqual({
      id: 'prod-1',
      name: 'Updated',
    });
    await expect(controller.deleteProduct('prod-1')).resolves.toEqual({ id: 'prod-1' });
  });
});
