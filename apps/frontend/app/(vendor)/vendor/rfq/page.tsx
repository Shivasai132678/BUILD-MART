'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { Spinner } from '@/components/ui/Spinner';
import { formatIST } from '@/lib/utils/date';
import { getApiErrorMessage } from '@/lib/api';
import { getAvailableRfqs } from '@/lib/vendor-api';

const PAGE_LIMIT = 10;

function getStatusBadgeClasses(status: 'OPEN' | 'QUOTED' | 'CLOSED' | 'EXPIRED') {
  if (status === 'OPEN') {
    return 'bg-emerald-100 text-emerald-800';
  }

  if (status === 'QUOTED') {
    return 'bg-amber-100 text-amber-800';
  }

  return 'bg-slate-100 text-slate-700';
}

export default function VendorRfqListPage() {
  const [offset, setOffset] = useState(0);

  const rfqsQuery = useQuery({
    queryKey: ['vendor-available-rfqs', PAGE_LIMIT, offset],
    queryFn: () => getAvailableRfqs(PAGE_LIMIT, offset),
    refetchInterval: 15_000,
  });

  if (rfqsQuery.isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-slate-700">
          <Spinner size="sm" />
          Loading available RFQs...
        </div>
      </div>
    );
  }

  if (rfqsQuery.isError || !rfqsQuery.data) {
    return (
      <ErrorMessage
        message={getApiErrorMessage(rfqsQuery.error, 'Failed to load available RFQs.')}
      />
    );
  }

  const { items, total, limit } = rfqsQuery.data;
  const hasPrev = offset > 0;
  const hasNext = offset + limit < total;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Available RFQs</h1>
          <p className="mt-1 text-sm text-slate-600">
            Matching RFQs for your city and product catalog
          </p>
        </div>
        {rfqsQuery.isFetching ? (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Spinner size="sm" />
            Refreshing (15s)
          </div>
        ) : null}
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-600">
          No matching RFQs right now. This list refreshes automatically.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((rfq) => (
            <Link
              key={rfq.id}
              href={`/vendor/rfq/${rfq.id}`}
              className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-slate-900">
                    RFQ #{rfq.id.slice(0, 8)}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    {rfq.city} • {rfq.items.length} item{rfq.items.length === 1 ? '' : 's'}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Created: {formatIST(rfq.createdAt)} • Valid until: {formatIST(rfq.validUntil)}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusBadgeClasses(
                    rfq.status,
                  )}`}
                >
                  {rfq.status}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setOffset((current) => Math.max(0, current - PAGE_LIMIT))}
          disabled={!hasPrev}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Prev
        </button>
        <p className="text-sm text-slate-600">
          Showing {Math.min(total, offset + 1)}-{Math.min(total, offset + items.length)} of{' '}
          {total}
        </p>
        <button
          type="button"
          onClick={() => setOffset((current) => current + PAGE_LIMIT)}
          disabled={!hasNext}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}

