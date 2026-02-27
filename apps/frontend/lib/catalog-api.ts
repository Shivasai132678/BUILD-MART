import { api, unwrapApiData } from '@/lib/api';

export type PaginatedResponse<T> = {
  items: T[];
  total: number;
  limit: number;
  offset: number;
};

export type CatalogCategory = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  imageUrl?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CatalogProduct = {
  id: string;
  categoryId: string;
  name: string;
  description?: string | null;
  unit: string;
  basePrice: string;
  imageUrl?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type ProductFilters = {
  categoryId?: string;
  search?: string;
  limit?: number;
  offset?: number;
};

export async function getCategories(limit = 100, offset = 0) {
  const response = await api.get('/api/v1/categories', {
    params: { limit, offset },
  });

  return unwrapApiData<PaginatedResponse<CatalogCategory>>(response.data);
}

export async function getProducts(filters?: ProductFilters) {
  const response = await api.get('/api/v1/products', {
    params: {
      limit: filters?.limit ?? 20,
      offset: filters?.offset ?? 0,
      ...(filters?.categoryId ? { categoryId: filters.categoryId } : {}),
      ...(filters?.search ? { search: filters.search } : {}),
    },
  });

  return unwrapApiData<PaginatedResponse<CatalogProduct>>(response.data);
}

export async function getProduct(id: string) {
  const response = await api.get(`/api/v1/products/${id}`);
  return unwrapApiData<CatalogProduct>(response.data);
}
