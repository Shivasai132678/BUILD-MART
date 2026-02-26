'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { Spinner } from '@/components/ui/Spinner';
import { fetchBuyerOrders, type Order } from '@/lib/buyer-api';
import { getApiErrorMessage } from '@/lib/api';
import { formatIST } from '@/lib/utils/date';

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

export default function BuyerOrdersPage() {
  const ordersQuery = useQuery({
    queryKey: ['buyer-orders', 'list', 10, 0],
    queryFn: () => fetchBuyerOrders(10, 0),
  });

  if (ordersQuery.isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-slate-700">
          <Spinner size="sm" />
          Loading orders...
        </div>
      </div>
    );
  }

  if (ordersQuery.isError || !ordersQuery.data) {
    return (
      <ErrorMessage
        message={getApiErrorMessage(ordersQuery.error, 'Failed to load orders.')}
      />
    );
  }

  const { items, total } = ordersQuery.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">My Orders</h1>
          <p className="mt-1 text-sm text-slate-600">
            Showing latest {items.length} of {total} orders
          </p>
        </div>
        <Link
          href="/buyer/rfq/new"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Create New RFQ
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-600">
          No orders yet. Accept a quote to create your first order.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((order) => (
            <Link
              key={order.id}
              href={`/buyer/orders/${order.id}`}
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
    </div>
  );
}

