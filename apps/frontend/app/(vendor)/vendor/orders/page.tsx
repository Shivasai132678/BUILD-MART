'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { Spinner } from '@/components/ui/Spinner';
import { getApiErrorMessage } from '@/lib/api';
import { type Order } from '@/lib/buyer-api';
import { formatIST } from '@/lib/utils/date';
import { getVendorOrders } from '@/lib/vendor-api';

const PAGE_LIMIT = 10;

function getStatusBadgeClasses(status: Order['status']): string {
  switch (status) {
    case 'CONFIRMED':
      return 'bg-blue-100 text-blue-800';
    case 'OUT_FOR_DELIVERY':
      return 'bg-amber-100 text-amber-800';
    case 'DELIVERED':
      return 'bg-emerald-100 text-emerald-800';
    case 'CANCELLED':
      return 'bg-rose-100 text-rose-800';
    default:
      return 'bg-slate-100 text-slate-700';
  }
}

export default function VendorOrdersPage() {
  const [offset, setOffset] = useState(0);

  const ordersQuery = useQuery({
    queryKey: ['vendor-orders', PAGE_LIMIT, offset],
    queryFn: () => getVendorOrders(PAGE_LIMIT, offset),
  });

  if (ordersQuery.isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-slate-700">
          <Spinner size="sm" />
          Loading vendor orders...
        </div>
      </div>
    );
  }

  if (ordersQuery.isError || !ordersQuery.data) {
    return (
      <ErrorMessage
        message={getApiErrorMessage(ordersQuery.error, 'Failed to load vendor orders.')}
      />
    );
  }

  const { items, total, limit } = ordersQuery.data;
  const hasPrev = offset > 0;
  const hasNext = offset + limit < total;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">My Orders</h1>
        <p className="mt-1 text-sm text-slate-600">
          Manage order status updates for accepted quotes.
        </p>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-600">
          No orders found yet.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((order) => (
            <Link
              key={order.id}
              href={`/vendor/orders/${order.id}`}
              className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-slate-900">
                  Order #{order.id.slice(0, 10)}
                </p>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusBadgeClasses(
                    order.status,
                  )}`}
                >
                  {order.status}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
                <span>Total: ₹{order.totalAmount}</span>
                <span>Created: {formatIST(order.createdAt)}</span>
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

