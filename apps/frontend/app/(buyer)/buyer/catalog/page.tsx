'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { Spinner } from '@/components/ui/Spinner';
import { getApiErrorMessage } from '@/lib/api';
import { getCategories, getProducts } from '@/lib/catalog-api';

const PAGE_SIZE = 20;

export default function BuyerCatalogPage() {
  const router = useRouter();
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setOffset(0);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const categoriesQuery = useQuery({
    queryKey: ['catalog-categories'],
    queryFn: () => getCategories(100, 0),
  });

  const productsQuery = useQuery({
    queryKey: ['catalog-products', selectedCategoryId, debouncedSearch, offset],
    queryFn: () =>
      getProducts({
        limit: PAGE_SIZE,
        offset,
        ...(selectedCategoryId ? { categoryId: selectedCategoryId } : {}),
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
      }),
  });

  const categories = categoriesQuery.data?.items ?? [];
  const products = productsQuery.data?.items ?? [];
  const total = productsQuery.data?.total ?? 0;
  const hasPrevious = offset > 0;
  const hasNext = offset + PAGE_SIZE < total;

  const categoryNameMap = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories],
  );

  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategoryId(categoryId);
    setOffset(0);
  };

  const handleAddToRfq = (productId: string) => {
    router.push(`/buyer/rfq/new?productId=${productId}`);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900">Product Catalog</h1>
        <p className="text-sm text-slate-600">
          Browse products by category and add any item directly to your RFQ.
        </p>
      </div>

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700" htmlFor="catalog-search">
            Search Products
          </label>
          <input
            id="catalog-search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search by product name..."
            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
          />
        </div>

        {categoriesQuery.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-slate-700">
            <Spinner size="sm" />
            Loading categories...
          </div>
        ) : null}

        <ErrorMessage
          message={
            categoriesQuery.isError
              ? getApiErrorMessage(
                  categoriesQuery.error,
                  'Failed to load categories.',
                )
              : null
          }
        />

        {!categoriesQuery.isLoading && !categoriesQuery.isError ? (
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => handleCategorySelect('')}
              className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium ${
                selectedCategoryId === ''
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              All
            </button>
            {categories.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => handleCategorySelect(category.id)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium ${
                  selectedCategoryId === category.id
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {category.name}
              </button>
            ))}
          </div>
        ) : null}
      </section>

      <section className="space-y-4">
        {productsQuery.isLoading ? (
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm">
            <Spinner size="sm" />
            Loading products...
          </div>
        ) : null}

        <ErrorMessage
          message={
            productsQuery.isError
              ? getApiErrorMessage(productsQuery.error, 'Failed to load products.')
              : null
          }
        />

        {!productsQuery.isLoading && !productsQuery.isError && products.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600 shadow-sm">
            No products found
          </div>
        ) : null}

        {!productsQuery.isLoading && !productsQuery.isError && products.length > 0 ? (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((product) => (
                <article
                  key={product.id}
                  className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="space-y-1">
                    <p className="text-base font-semibold text-slate-900">{product.name}</p>
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <span className="font-medium text-slate-900">₹{product.basePrice}</span>
                      <span>per {product.unit}</span>
                    </div>
                    <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                      {categoryNameMap.get(product.categoryId) ?? 'Category'}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleAddToRfq(product.id)}
                    className="inline-flex w-full items-center justify-center rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
                  >
                    Add to RFQ
                  </button>
                </article>
              ))}
            </div>

            <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-sm text-slate-600">
                Showing {Math.min(offset + 1, total)}-
                {Math.min(offset + PAGE_SIZE, total)} of {total}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setOffset((value) => Math.max(0, value - PAGE_SIZE))}
                  disabled={!hasPrevious}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setOffset((value) => value + PAGE_SIZE)}
                  disabled={!hasNext}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        ) : null}
      </section>
    </div>
  );
}
