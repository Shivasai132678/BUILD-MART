'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { fetchBuyerRfqs, type Rfq } from '@/lib/buyer-api';
import { formatIST } from '@/lib/utils/date';

function RfqStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    OPEN: 'bg-[#D97706]/15 text-[#F59E0B] border border-[#D97706]/30',
    QUOTED: 'bg-blue-500/15 text-blue-400 border border-blue-500/30',
    CLOSED: 'bg-green-600/15 text-green-300 border border-green-500/30',
    EXPIRED: 'bg-[#3A3027]/50 text-[#7A7067] border border-[#3A3027]',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold ${map[status] ?? 'bg-[#3A3027]/50 text-[#A89F91]'}`}>
      {status}
    </span>
  );
}

const LIMIT = 10;

export default function BuyerRfqListPage() {
  const [offset, setOffset] = useState(0);

  const rfqQuery = useQuery({
    queryKey: ['buyer-rfqs', offset],
    queryFn: () => fetchBuyerRfqs(LIMIT, offset),
  });

  const rfqs: Rfq[] = rfqQuery.data?.items ?? [];
  const total: number = rfqQuery.data?.total ?? 0;
  const totalPages = Math.ceil(total / LIMIT);
  const currentPage = Math.floor(offset / LIMIT) + 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#F5F0E8]">My RFQs</h1>
          <p className="text-sm text-[#A89F91] mt-0.5">Manage your requests for quote</p>
        </div>
        <Link
          href="/buyer/rfq/new"
          className="inline-flex items-center gap-2 bg-[#D97706] hover:bg-[#B45309] text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          New RFQ
        </Link>
      </div>

      {/* Content */}
      <div className="bg-[#1A1714] border border-[#2A2520] rounded-2xl overflow-hidden">
        {/* Table header */}
        <div className="hidden md:grid grid-cols-[1fr_120px_80px_100px_160px] gap-4 px-5 py-3 border-b border-[#2A2520] text-xs font-semibold text-[#7A7067] uppercase tracking-wide">
          <span>RFQ</span>
          <span>Location</span>
          <span>Items</span>
          <span>Status</span>
          <span>Created</span>
        </div>

        {rfqQuery.isLoading ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-14 bg-[#211E19] rounded-xl animate-pulse" />
            ))}
          </div>
        ) : rfqQuery.isError ? (
          <div className="p-12 text-center">
            <span className="material-symbols-outlined text-4xl text-[#7A7067]">error</span>
            <p className="mt-3 font-semibold text-[#F5F0E8]">Failed to load RFQs</p>
            <p className="text-sm text-[#A89F91] mt-1">Please try again later.</p>
          </div>
        ) : rfqs.length === 0 ? (
          <div className="p-12 text-center">
            <span className="material-symbols-outlined text-5xl text-[#3A3027]">description</span>
            <p className="mt-3 font-semibold text-[#F5F0E8]">No RFQs yet</p>
            <p className="text-sm text-[#A89F91] mt-1">Create your first RFQ to get quotes from vendors.</p>
            <Link
              href="/buyer/rfq/new"
              className="inline-flex items-center gap-2 mt-5 bg-[#D97706] hover:bg-[#B45309] text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              Create RFQ
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-[#2A2520]">
            {rfqs.map((rfq) => (
              <Link
                key={rfq.id}
                href={`/buyer/rfq/${rfq.id}`}
                className="flex flex-col md:grid md:grid-cols-[1fr_120px_80px_100px_160px] gap-2 md:gap-4 items-start md:items-center px-5 py-4 hover:bg-[#211E19] transition-colors group"
              >
                {/* RFQ ID */}
                <div className="flex items-center gap-2 min-w-0">
                  <span className="material-symbols-outlined text-[#D97706] text-[18px] shrink-0">request_quote</span>
                  <span className="text-sm font-mono text-[#D97706] group-hover:text-[#F59E0B] transition-colors truncate">
                    #{rfq.id.slice(0, 10)}
                  </span>
                  {rfq.notes && (
                    <span className="hidden lg:block text-xs text-[#7A7067] truncate ml-1">— {rfq.notes}</span>
                  )}
                </div>

                {/* Location */}
                <div className="flex items-center gap-1.5 text-sm text-[#A89F91]">
                  <span className="material-symbols-outlined text-[14px]">location_on</span>
                  {rfq.city}
                </div>

                {/* Items */}
                <div className="text-sm text-[#A89F91]">
                  {rfq.items.length} {rfq.items.length === 1 ? 'item' : 'items'}
                </div>

                {/* Status */}
                <div>
                  <RfqStatusBadge status={rfq.status} />
                </div>

                {/* Date */}
                <div className="text-xs text-[#7A7067]">
                  {formatIST(rfq.createdAt)}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-[#7A7067]">
            Showing {offset + 1}–{Math.min(offset + LIMIT, total)} of {total} RFQs
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setOffset((p) => Math.max(0, p - LIMIT))}
              disabled={currentPage === 1}
              className="flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-medium bg-[#1A1714] border border-[#2A2520] text-[#A89F91] hover:text-[#F5F0E8] hover:border-[#3A3027] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">chevron_left</span>
              Prev
            </button>
            <span className="text-sm text-[#7A7067] px-1">
              {currentPage} / {totalPages}
            </span>
            <button
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
    </div>
  );
}
