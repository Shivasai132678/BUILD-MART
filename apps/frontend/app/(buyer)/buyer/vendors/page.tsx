'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { discoverVendors, type VendorDiscoveryItem } from '@/lib/buyer-api';
import { PageTransition, StaggerContainer, StaggerItem } from '@/components/ui/Motion';
import { formatIST } from '@/lib/utils/date';

const LIMIT = 12;

function StarRating({ rating }: { rating: string }) {
  const r = Math.round(Number(rating));
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <span key={s} className={`text-sm ${s <= r ? 'text-[#D97706]' : 'text-[#3A3027]'}`}>★</span>
      ))}
      <span className="ml-1 text-xs text-[#7A7067]">{Number(rating).toFixed(1)}</span>
    </span>
  );
}

function VendorCard({ vendor }: { vendor: VendorDiscoveryItem }) {
  return (
    <Link href={`/buyer/vendors/${vendor.id}`} className="block group">
      <div className="h-full bg-[#1A1714] hover:bg-[#211E19] border border-[#2A2520] hover:border-[#D97706]/30 rounded-2xl p-5 transition-all duration-300 hover:shadow-lg hover:shadow-[#D97706]/5 cursor-pointer">
        {/* Avatar + arrow */}
        <div className="flex items-start gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-[#D97706]/15 flex items-center justify-center shrink-0 group-hover:bg-[#D97706]/25 transition-colors">
            <span className="material-symbols-outlined text-[#D97706] text-[22px]">storefront</span>
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-[#F5F0E8] truncate">{vendor.businessName}</h3>
            <p className="text-sm text-[#A89F91] flex items-center gap-1 mt-0.5">
              <span className="material-symbols-outlined text-[13px]">location_on</span>
              {vendor.city}
            </p>
          </div>
          <span className="material-symbols-outlined text-[#3A3027] group-hover:text-[#D97706] text-[20px] shrink-0 transition-colors mt-0.5">chevron_right</span>
        </div>

        <StarRating rating={vendor.averageRating} />
        <p className="text-xs text-[#7A7067] mt-1">{vendor.totalReviews} review{vendor.totalReviews !== 1 ? 's' : ''}</p>

        <div className="mt-4 flex items-center justify-between text-xs text-[#7A7067]">
          <span className="flex items-center gap-1">
            <span className="material-symbols-outlined text-[13px]">inventory_2</span>
            {vendor._count.products} product{vendor._count.products !== 1 ? 's' : ''}
          </span>
          {vendor.approvedAt && (
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[13px]">verified</span>
              Since {formatIST(vendor.approvedAt)}
            </span>
          )}
        </div>

        {vendor.serviceableAreas.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {vendor.serviceableAreas.slice(0, 3).map((area) => (
              <span key={area} className="px-2 py-0.5 rounded-full bg-[#2A2520] text-[10px] text-[#A89F91]">{area}</span>
            ))}
            {vendor.serviceableAreas.length > 3 && (
              <span className="px-2 py-0.5 rounded-full bg-[#2A2520] text-[10px] text-[#7A7067]">+{vendor.serviceableAreas.length - 3}</span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}

export default function VendorDiscoveryPage() {
  const [city, setCity] = useState('');
  const [minRating, setMinRating] = useState('');
  const [offset, setOffset] = useState(0);
  const [appliedCity, setAppliedCity] = useState('');
  const [appliedRating, setAppliedRating] = useState('');

  const vendorsQuery = useQuery({
    queryKey: ['vendor-discovery', appliedCity, appliedRating, offset],
    queryFn: () =>
      discoverVendors({
        ...(appliedCity ? { city: appliedCity } : {}),
        ...(appliedRating ? { minRating: Number(appliedRating) } : {}),
        limit: LIMIT,
        offset,
      }),
  });

  const vendors = vendorsQuery.data?.items ?? [];
  const total = vendorsQuery.data?.total ?? 0;
  const totalPages = Math.ceil(total / LIMIT);
  const currentPage = Math.floor(offset / LIMIT) + 1;

  const handleSearch = () => {
    setOffset(0);
    setAppliedCity(city.trim());
    setAppliedRating(minRating);
  };

  const handleReset = () => {
    setCity('');
    setMinRating('');
    setOffset(0);
    setAppliedCity('');
    setAppliedRating('');
  };

  return (
    <PageTransition className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#F5F0E8]">Discover Vendors</h1>
        <p className="text-sm text-[#A89F91] mt-0.5">Browse approved vendors in your area and create targeted RFQs</p>
      </div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="bg-[#1A1714] border border-[#2A2520] rounded-2xl p-4 flex flex-wrap items-end gap-3"
      >
        <div className="flex-1 min-w-[160px]">
          <label className="block text-xs font-semibold text-[#7A7067] uppercase tracking-wide mb-1.5">City</label>
          <input
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
            placeholder="e.g. Mumbai"
            className="w-full rounded-xl border border-[#2A2520] bg-[#211E19] px-3 py-2 text-sm text-[#F5F0E8] placeholder:text-[#7A7067] outline-none focus:border-[#D97706] focus:ring-2 focus:ring-[#D97706]/20 transition-all"
          />
        </div>

        <div className="min-w-[140px]">
          <label className="block text-xs font-semibold text-[#7A7067] uppercase tracking-wide mb-1.5">Min Rating</label>
          <select
            value={minRating}
            onChange={(e) => setMinRating(e.target.value)}
            className="w-full rounded-xl border border-[#2A2520] bg-[#211E19] px-3 py-2 text-sm text-[#F5F0E8] outline-none focus:border-[#D97706] focus:ring-2 focus:ring-[#D97706]/20 transition-all"
          >
            <option value="">Any rating</option>
            <option value="3">3+ stars</option>
            <option value="4">4+ stars</option>
            <option value="4.5">4.5+ stars</option>
          </select>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSearch}
            disabled={vendorsQuery.isFetching}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-[#D97706] hover:bg-[#B45309] text-white transition-all disabled:opacity-60"
          >
            <span className="material-symbols-outlined text-[16px]">search</span>
            Search
          </button>
          {(appliedCity || appliedRating) && (
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-medium border border-[#2A2520] text-[#A89F91] hover:text-[#F5F0E8] hover:border-[#3A3027] transition-all"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
              Clear
            </button>
          )}
        </div>

        <div className="ml-auto self-center text-xs text-[#7A7067]">
          {vendorsQuery.isFetching ? (
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[13px] animate-spin">progress_activity</span>
              Loading…
            </span>
          ) : (
            `${total} vendor${total !== 1 ? 's' : ''} found`
          )}
        </div>
      </motion.div>

      {/* Grid */}
      {vendorsQuery.isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: LIMIT }).map((_, i) => (
            <div key={i} className="bg-[#1A1714] border border-[#2A2520] rounded-2xl h-44 animate-pulse" />
          ))}
        </div>
      ) : vendorsQuery.isError ? (
        <div className="bg-[#1A1714] border border-[#2A2520] rounded-2xl p-12 text-center">
          <span className="material-symbols-outlined text-4xl text-[#7A7067]">error</span>
          <p className="mt-3 font-semibold text-[#F5F0E8]">Failed to load vendors</p>
          <p className="mt-1 text-sm text-[#A89F91]">Please try again</p>
        </div>
      ) : vendors.length === 0 ? (
        <div className="bg-[#1A1714] border border-dashed border-[#2A2520] rounded-2xl p-16 text-center">
          <span className="material-symbols-outlined text-5xl text-[#3A3027]">store</span>
          <p className="mt-3 font-semibold text-[#F5F0E8]">No vendors found</p>
          <p className="mt-1 text-sm text-[#A89F91]">Try adjusting your filters to find vendors in your area.</p>
        </div>
      ) : (
        <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {vendors.map((vendor) => (
            <StaggerItem key={vendor.id}>
              <VendorCard vendor={vendor} />
            </StaggerItem>
          ))}
        </StaggerContainer>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-[#7A7067]">
            Page {currentPage} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setOffset((p) => Math.max(0, p - LIMIT))}
              disabled={currentPage === 1}
              className="flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-medium bg-[#1A1714] border border-[#2A2520] text-[#A89F91] hover:text-[#F5F0E8] hover:border-[#3A3027] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">chevron_left</span>
              Prev
            </button>
            <button
              type="button"
              onClick={() => setOffset((p) => p + LIMIT)}
              disabled={currentPage === totalPages}
              className="flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-medium bg-[#1A1714] border border-[#2A2520] text-[#A89F91] hover:text-[#F5F0E8] hover:border-[#3A3027] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next
              <span className="material-symbols-outlined text-[16px]">chevron_right</span>
            </button>
          </div>
        </div>
      )}
    </PageTransition>
  );
}
