'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { formatIST } from '@/lib/utils/date';
import { getCategories } from '@/lib/catalog-api';
import { browseAllRfqs } from '@/lib/vendor-api';

export default function AllRfqsPage() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const limit = 20;

  const categoriesQuery = useQuery({
    queryKey: ['categories'],
    queryFn: () => getCategories(),
  });

  const rfqsQuery = useQuery({
    queryKey: ['all-rfqs', selectedCategory, page],
    queryFn: () => browseAllRfqs(limit, page * limit, selectedCategory ?? undefined),
  });

  const totalPages = Math.ceil((rfqsQuery.data?.total || 0) / limit);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#F5F0E8]">Browse All RFQs</h1>
        <p className="text-[#8EA5C0] text-sm mt-1">
          View all open RFQs on the platform. You can quote on any RFQ regardless of your products.
        </p>
      </div>

      {/* Category Filter */}
      <div>
        <label className="block text-sm font-medium text-[#8EA5C0] mb-2">
          Filter by category (optional)
        </label>
        {categoriesQuery.isLoading ? (
          <div className="flex items-center gap-2 text-[#4A6080]">
            <span className="material-symbols-outlined animate-spin">progress_activity</span>
            Loading categories...
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => { setSelectedCategory(null); setPage(0); }}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                selectedCategory === null
                  ? 'bg-blue text-white'
                  : 'bg-[#1E2A3A] text-[#8EA5C0] hover:bg-[#2A3545]'
              }`}
            >
              All Categories
            </button>
            {categoriesQuery.data?.items.map((cat) => (
              <button
                key={cat.id}
                onClick={() => { setSelectedCategory(cat.id); setPage(0); }}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  selectedCategory === cat.id
                    ? 'bg-blue text-white'
                    : 'bg-[#1E2A3A] text-[#8EA5C0] hover:bg-[#2A3545]'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Info banner */}
      <div className="bg-blue/10 border border-blue/20 rounded-xl px-4 py-3 flex items-start gap-3">
        <span className="material-symbols-outlined text-blue text-[20px] mt-0.5">info</span>
        <div className="text-sm">
          <p className="text-[#F5F0E8]">Browsing all RFQs</p>
          <p className="text-[#8EA5C0] mt-0.5">
            For best results, quote on RFQs that match your products. Check your{' '}
            <Link href="/vendor/profile/products" className="text-blue hover:underline">
              My Products
            </Link>{' '}
            page to see what you currently offer.
          </p>
        </div>
      </div>

      {/* RFQs List */}
      {rfqsQuery.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-[#111827] border border-[#1E2A3A] rounded-2xl h-24 animate-pulse" />
          ))}
        </div>
      ) : rfqsQuery.data?.items.length === 0 ? (
        <div className="bg-[#111827] border border-[#1E2A3A] rounded-2xl flex flex-col items-center justify-center py-20 text-center px-6">
          <span className="material-symbols-outlined text-[56px] text-[#1E2A3A] mb-4">request_quote</span>
          <p className="text-base font-medium text-[#F5F0E8]">No RFQs available</p>
          <p className="text-sm text-[#8EA5C0] mt-1">There are no open RFQs at the moment</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rfqsQuery.data?.items.map((rfq) => (
            <RfqCard key={rfq.id} rfq={rfq} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0 || rfqsQuery.isLoading}
            className="p-2 rounded-lg bg-[#1E2A3A] text-[#8EA5C0] hover:bg-[#2A3545] disabled:opacity-50 transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">chevron_left</span>
          </button>
          <span className="text-sm text-[#8EA5C0]">
            Page {page + 1} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1 || rfqsQuery.isLoading}
            className="p-2 rounded-lg bg-[#1E2A3A] text-[#8EA5C0] hover:bg-[#2A3545] disabled:opacity-50 transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">chevron_right</span>
          </button>
        </div>
      )}
    </div>
  );
}

function RfqCard({ rfq }: { rfq: { id: string; referenceCode?: string | null; title?: string | null; city: string; status: string; validUntil: string; items: Array<{ product?: { name: string } | null }> } }) {
  return (
    <div className="bg-[#111827] border border-[#1E2A3A] rounded-2xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <p className="text-base font-semibold text-[#F5F0E8]">
              {rfq.title || `RFQ ${rfq.referenceCode || rfq.id.slice(0, 8)}`}
            </p>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-green-500/15 text-green-400 border border-green-500/30">
              {rfq.status}
            </span>
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-[#8EA5C0]">
            <span className="inline-flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">location_on</span>
              {rfq.city}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">schedule</span>
              Valid until {formatIST(rfq.validUntil)}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">inventory_2</span>
              {rfq.items.length} items
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {rfq.items.slice(0, 3).map((item, i) => (
              <span
                key={i}
                className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] bg-[#1E2A3A] text-[#4A6080]"
              >
                {item.product?.name || 'Unknown Product'}
              </span>
            ))}
            {rfq.items.length > 3 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] bg-[#1E2A3A] text-[#4A6080]">
                +{rfq.items.length - 3} more
              </span>
            )}
          </div>
        </div>
        <Link
          href={`/vendor/rfq/${rfq.id}`}
          className="inline-flex items-center gap-1.5 bg-blue/15 hover:bg-blue/25 text-blue border border-blue/30 hover:border-blue/50 px-3 py-2 rounded-xl text-sm font-medium transition-colors"
        >
          View & Quote
          <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
        </Link>
      </div>
    </div>
  );
}
