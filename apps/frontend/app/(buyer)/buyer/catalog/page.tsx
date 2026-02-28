'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Plus } from 'lucide-react';
import { getCategories, getProducts } from '@/lib/catalog-api';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

const pageV = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] } } };
const listV = { visible: { transition: { staggerChildren: 0.07 } } };
const itemV = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] } } };

const PAGE_SIZE = 20;

export default function BuyerCatalogPage() {
  const router = useRouter();
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => { setDebouncedSearch(searchInput.trim()); setOffset(0); }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const categoriesQuery = useQuery({ queryKey: ['catalog-categories'], queryFn: () => getCategories(100, 0) });
  const productsQuery = useQuery({
    queryKey: ['catalog-products', selectedCategoryId, debouncedSearch, offset],
    queryFn: () => getProducts({ limit: PAGE_SIZE, offset, ...(selectedCategoryId ? { categoryId: selectedCategoryId } : {}), ...(debouncedSearch ? { search: debouncedSearch } : {}) }),
  });

  const categories = categoriesQuery.data?.items ?? [];
  const products = productsQuery.data?.items ?? [];
  const total = productsQuery.data?.total ?? 0;
  const categoryNameMap = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

  return (
    <motion.div className="space-y-6" variants={pageV} initial="hidden" animate="visible">
      <PageHeader title="Product Catalog" subtitle="Browse products and add them to your RFQ." />

      {/* Filter bar */}
      <div className="card p-4 space-y-3">
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-text-tertiary"><Search className="h-4 w-4" /></div>
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by product name…"
            className="w-full h-10 rounded-xl border border-border bg-elevated pl-10 pr-4 text-sm text-text-primary placeholder:text-text-tertiary outline-none transition-all focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
        </div>
        {!categoriesQuery.isLoading && categories.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button type="button" onClick={() => { setSelectedCategoryId(''); setOffset(0); }}
              className={cn('shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-all duration-200', selectedCategoryId === '' ? 'bg-accent/15 text-accent' : 'text-text-secondary hover:text-text-primary hover:bg-elevated')}>
              All
            </button>
            {categories.map((cat) => (
              <button key={cat.id} type="button" onClick={() => { setSelectedCategoryId(cat.id); setOffset(0); }}
                className={cn('shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-all duration-200', selectedCategoryId === cat.id ? 'bg-accent/15 text-accent' : 'text-text-secondary hover:text-text-primary hover:bg-elevated')}>
                {cat.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {productsQuery.isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}</div>
      ) : products.length === 0 ? (
        <EmptyState title="No products found" subtitle="Try adjusting your search or filter criteria." />
      ) : (
        <>
          <motion.div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" variants={listV} initial="hidden" animate="visible">
            {products.map((product) => (
              <motion.div key={product.id} variants={itemV}>
                <article className="card group p-5">
                  <p className="text-base font-semibold text-text-primary">{product.name}</p>
                  <div className="flex items-center gap-2 text-sm mt-1">
                    <span className="font-semibold text-text-primary">₹{product.basePrice}</span>
                    <span className="text-text-tertiary">per {product.unit}</span>
                  </div>
                  <span className="inline-flex mt-2 rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-medium text-accent border border-accent/20">
                    {categoryNameMap.get(product.categoryId) ?? 'Category'}
                  </span>
                  <div className="mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="secondary" size="sm" className="w-full" onClick={() => router.push(`/buyer/rfq/new?productId=${product.id}`)}>
                      <Plus className="h-4 w-4" />Add to RFQ
                    </Button>
                  </div>
                </article>
              </motion.div>
            ))}
          </motion.div>

          <div className="card flex items-center justify-between p-4">
            <p className="text-sm text-text-secondary">Showing {Math.min(offset + 1, total)}–{Math.min(offset + PAGE_SIZE, total)} of {total}</p>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => setOffset((v) => Math.max(0, v - PAGE_SIZE))} disabled={offset === 0}>Previous</Button>
              <Button variant="secondary" size="sm" onClick={() => setOffset((v) => v + PAGE_SIZE)} disabled={offset + PAGE_SIZE >= total}>Next</Button>
            </div>
          </div>
        </>
      )}
    </motion.div>
  );
}
