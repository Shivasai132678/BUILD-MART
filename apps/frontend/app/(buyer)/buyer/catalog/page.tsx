'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { getCategories, getProducts } from '@/lib/catalog-api';

const PAGE_SIZE = 20;

function getProductImage(name: string, imageUrl?: string | null): string {
  if (imageUrl) return imageUrl;
  const lower = name.toLowerCase();
  if (lower.includes('cement')) return '/images/products/cement-bag.png';
  if (lower.includes('steel') || lower.includes('tmt') || lower.includes('rod') || lower.includes('bar')) return '/images/products/tmt-bar.png';
  if (lower.includes('brick') || lower.includes('block')) return '/images/products/brick.png';
  if (lower.includes('tile') || lower.includes('flooring')) return '/images/products/tile.png';
  if (lower.includes('pipe') || lower.includes('plumb') || lower.includes('pvc')) return '/images/products/pvc-pipe.png';
  return '/images/products/placeholder.png';
}

export default function BuyerCatalogPage() {
  const router = useRouter();
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const timer = window.setTimeout(() => { setDebouncedSearch(searchInput.trim()); setOffset(0); }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const categoriesQuery = useQuery({ queryKey: ['catalog-categories'], queryFn: () => getCategories(100, 0) });
  const productsQuery = useQuery({
    queryKey: ['catalog-products', selectedCategoryId, debouncedSearch, offset],
    queryFn: () => getProducts({ limit: PAGE_SIZE, offset, ...(selectedCategoryId ? { categoryId: selectedCategoryId } : {}), ...(debouncedSearch ? { search: debouncedSearch } : {}) }),
  });
  const allProductsCount = useQuery({ queryKey: ['catalog-products-total'], queryFn: () => getProducts({ limit: 1, offset: 0 }) });

  const categories = categoriesQuery.data?.items ?? [];
  const products = productsQuery.data?.items ?? [];
  const total = productsQuery.data?.total ?? 0;
  const totalAll = allProductsCount.data?.total ?? 0;
  const categoryNameMap = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

  return (
    <div className="flex gap-6 max-w-7xl mx-auto">
      {/* Sidebar filters */}
      <aside className="hidden lg:block w-64 flex-shrink-0 space-y-4">
        <div className="bg-[#1A1714] border border-[#2A2520] rounded-2xl p-4">
          <h3 className="text-sm font-semibold text-[#F5F0E8] mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-[#D97706] text-[18px]">category</span>
            Categories
          </h3>
          <div className="space-y-1">
            <button
              onClick={() => { setSelectedCategoryId(''); setOffset(0); }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-colors ${selectedCategoryId === '' ? 'bg-[#D97706]/15 text-[#F59E0B] font-medium' : 'text-[#A89F91] hover:bg-[#211E19] hover:text-[#F5F0E8]'}`}
            >
              All Products
              <span className="text-xs">{categoriesQuery.isLoading ? '…' : totalAll}</span>
            </button>
            {categoriesQuery.isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-8 bg-[#211E19] rounded-xl animate-pulse" />
              ))
            ) : (
              categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => { setSelectedCategoryId(cat.id); setOffset(0); }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-colors ${selectedCategoryId === cat.id ? 'bg-[#D97706]/15 text-[#F59E0B] font-medium' : 'text-[#A89F91] hover:bg-[#211E19] hover:text-[#F5F0E8]'}`}
                >
                  {cat.name}
                </button>
              ))
            )}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0 space-y-5">
        {/* Header + search */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[#F5F0E8]">Product Catalog</h1>
            <p className="text-sm text-[#A89F91] mt-0.5">Browse and add products to your RFQ</p>
          </div>
          <div className="relative w-full sm:w-72">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#7A7067] text-[20px]">search</span>
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search products…"
              className="w-full h-10 rounded-xl border border-[#3A3027] bg-[#1A1714] pl-10 pr-4 text-sm text-[#F5F0E8] placeholder:text-[#5A5047] outline-none transition-all focus:border-[#D97706] focus:ring-2 focus:ring-[#D97706]/20"
            />
          </div>
        </div>

        {/* Mobile category pills */}
        {!categoriesQuery.isLoading && categories.length > 0 && (
          <div className="flex lg:hidden gap-2 overflow-x-auto pb-1">
            <button onClick={() => { setSelectedCategoryId(''); setOffset(0); }}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-all border ${selectedCategoryId === '' ? 'bg-[#D97706]/15 text-[#F59E0B] border-[#D97706]/30' : 'text-[#A89F91] border-[#2A2520] hover:text-[#F5F0E8]'}`}>
              All
            </button>
            {categories.map((cat) => (
              <button key={cat.id} onClick={() => { setSelectedCategoryId(cat.id); setOffset(0); }}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-all border ${selectedCategoryId === cat.id ? 'bg-[#D97706]/15 text-[#F59E0B] border-[#D97706]/30' : 'text-[#A89F91] border-[#2A2520] hover:text-[#F5F0E8]'}`}>
                {cat.name}
              </button>
            ))}
          </div>
        )}

        {/* Results count */}
        {!productsQuery.isLoading && (
          <p className="text-sm text-[#7A7067]">{total} product{total !== 1 ? 's' : ''} found</p>
        )}

        {/* Product grid */}
        {productsQuery.isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-[#1A1714] border border-[#2A2520] rounded-2xl overflow-hidden animate-pulse">
                <div className="h-44 bg-[#211E19]" />
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-[#211E19] rounded-lg w-3/4" />
                  <div className="h-3 bg-[#211E19] rounded-lg w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <span className="material-symbols-outlined text-[56px] text-[#3A3027] mb-4">inventory_2</span>
            <p className="text-base font-medium text-[#A89F91]">No products found</p>
            <p className="text-sm text-[#7A7067] mt-1">Try adjusting your search or category filter</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {products.map((product) => {
              const imgSrc = getProductImage(product.name, product.imageUrl);
              return (
                <article key={product.id} className="bg-[#1A1714] border border-[#2A2520] rounded-2xl overflow-hidden group hover:border-[#D97706]/40 transition-colors">
                  <div className="relative h-44 bg-[#211E19] overflow-hidden">
                    <Image
                      src={imgErrors[product.id] ? '/images/products/placeholder.png' : imgSrc}
                      alt={product.name}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={() => setImgErrors((prev) => ({ ...prev, [product.id]: true }))}
                    />
                  </div>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-semibold text-[#F5F0E8] text-sm leading-snug">{product.name}</h3>
                      <span className="shrink-0 text-xs bg-[#D97706]/15 text-[#F59E0B] border border-[#D97706]/20 px-2 py-0.5 rounded-full font-medium">
                        {categoryNameMap.get(product.categoryId) ?? '—'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-sm mb-4">
                      <span className="font-bold text-[#F5F0E8]">₹{product.basePrice}</span>
                      <span className="text-[#7A7067]">/ {product.unit}</span>
                    </div>
                    <button
                      onClick={() => router.push(`/buyer/rfq/new?productId=${product.id}`)}
                      className="w-full flex items-center justify-center gap-2 bg-[#D97706] hover:bg-[#B45309] text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
                    >
                      <span className="material-symbols-outlined text-[16px]">add_shopping_cart</span>
                      Add to RFQ
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between bg-[#1A1714] border border-[#2A2520] rounded-2xl p-4">
            <p className="text-sm text-[#A89F91]">
              Showing {Math.min(offset + 1, total)}–{Math.min(offset + PAGE_SIZE, total)} of {total}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setOffset((v) => Math.max(0, v - PAGE_SIZE))}
                disabled={offset === 0}
                className="flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-medium bg-[#211E19] text-[#A89F91] hover:text-[#F5F0E8] hover:bg-[#2A2520] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                Prev
              </button>
              <button
                onClick={() => setOffset((v) => v + PAGE_SIZE)}
                disabled={offset + PAGE_SIZE >= total}
                className="flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-medium bg-[#D97706] text-white hover:bg-[#B45309] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
