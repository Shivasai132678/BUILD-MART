'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { getAvailableRfqs } from '@/lib/vendor-api';
import { formatIST } from '@/lib/utils/date';

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; classes: string }> = {
    OPEN:    { label: 'Open',    classes: 'bg-blue-500/15 text-blue-400 border border-blue-500/30' },
    QUOTED:  { label: 'Quoted',  classes: 'bg-green-500/15 text-green-400 border border-green-500/30' },
    CLOSED:  { label: 'Closed',  classes: 'bg-[#4A6080]/20 text-[#8EA5C0] border border-[#1E2A3A]' },
    EXPIRED: { label: 'Expired', classes: 'bg-red-500/10 text-red-400 border border-red-500/20' },
  };
  const { label, classes } = map[status] ?? { label: status, classes: 'bg-[#4A6080]/20 text-[#8EA5C0]' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${classes}`}>
      {label}
    </span>
  );
}

const PAGE_SIZE = 50;

export default function VendorRfqListPage() {
  const [citySearch, setCitySearch] = useState('');

  const rfqsQuery = useQuery({
    queryKey: ['vendor-available-rfqs'],
    queryFn: () => getAvailableRfqs(PAGE_SIZE, 0),
    refetchInterval: 30_000,
  });

  const allItems = rfqsQuery.data?.items ?? [];

  // Client-side city filter (backend /available doesn't expose city param)
  const items = useMemo(() => {
    const q = citySearch.trim().toLowerCase();
    if (!q) return allItems;
    return allItems.filter((rfq) => rfq.city?.toLowerCase().includes(q));
  }, [allItems, citySearch]);

  const total = rfqsQuery.data?.total ?? 0;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[#F5F0E8]">Available RFQs</h1>
          <p className="text-[#8EA5C0] text-sm mt-1">
            {citySearch ? `${items.length} of ${total}` : total} open request{total !== 1 ? 's' : ''}
            {rfqsQuery.isFetching && !rfqsQuery.isLoading && (
              <span className="ml-2 inline-flex items-center gap-1 text-[#3B7FC1]">
                <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>
                Refreshing
              </span>
            )}
          </p>
        </div>
      </div>

      {/* City search filter */}
      <div className="relative max-w-xs">
        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#4A6080] text-[18px]">
          location_on
        </span>
        <input
          type="text"
          placeholder="Filter by city…"
          value={citySearch}
          onChange={(e) => setCitySearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 rounded-xl bg-[#111827] border border-[#1E2A3A] text-sm text-[#F5F0E8] placeholder-[#4A6080] focus:outline-none focus:border-[#3B7FC1] transition-colors"
        />
        {citySearch && (
          <button
            onClick={() => setCitySearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4A6080] hover:text-[#8EA5C0] transition-colors"
            aria-label="Clear filter"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        )}
      </div>

      {/* Content */}
      {rfqsQuery.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-[#111827] border border-[#1E2A3A] rounded-2xl h-20 animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="bg-[#111827] border border-[#1E2A3A] rounded-2xl flex flex-col items-center justify-center py-20 text-center px-6">
          <span className="material-symbols-outlined text-[56px] text-[#1E2A3A] mb-4">request_quote</span>
          <p className="text-base font-medium text-[#F5F0E8]">
            {citySearch ? `No RFQs in "${citySearch}"` : 'No open RFQs'}
          </p>
          <p className="text-sm text-[#8EA5C0] mt-1 max-w-xs">
            {citySearch
              ? 'Try a different city name or clear the filter.'
              : 'New RFQs matching your profile will appear here automatically every 30 seconds.'}
          </p>
          {citySearch && (
            <button
              onClick={() => setCitySearch('')}
              className="mt-4 text-sm text-[#3B7FC1] hover:underline"
            >
              Clear filter
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((rfq) => (
            <Link
              key={rfq.id}
              href={`/vendor/rfq/${rfq.id}`}
              className="bg-[#111827] border border-[#1E2A3A] hover:border-[#3B7FC1]/30 rounded-2xl flex items-center gap-4 px-5 py-4 group transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-[#3B7FC1]/15 flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-[#3B7FC1] text-[20px]">request_quote</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="font-mono text-xs text-[#3B7FC1]">
                    {rfq.referenceCode ?? `#${rfq.id.slice(0, 8)}`}
                  </span>
                  <StatusBadge status={rfq.status} />
                </div>
                <p className="text-sm text-[#8EA5C0]">
                  <span className="inline-flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">location_on</span>
                    {rfq.city}
                  </span>
                  <span className="mx-2 text-[#1E2A3A]">·</span>
                  {rfq.items?.length ?? 0} item{(rfq.items?.length ?? 0) !== 1 ? 's' : ''}
                  <span className="mx-2 text-[#1E2A3A]">·</span>
                  {formatIST(rfq.createdAt)}
                </p>
              </div>
              <span className="material-symbols-outlined text-[18px] text-[#1E2A3A] group-hover:text-[#3B7FC1] transition-colors flex-shrink-0">
                arrow_forward
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
