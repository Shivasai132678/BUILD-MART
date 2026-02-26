'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { Spinner } from '@/components/ui/Spinner';
import { getApiErrorMessage } from '@/lib/api';
import { type Order, type OrderDetail } from '@/lib/buyer-api';
import { formatIST } from '@/lib/utils/date';
import { getVendorOrderById, updateOrderStatus } from '@/lib/vendor-api';

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

function TimelineRow({
  label,
  timestamp,
}: {
  label: string;
  timestamp?: string | null;
}) {
  if (!timestamp) {
    return null;
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm">
      <span className="font-medium text-slate-800">{label}</span>
      <span className="text-slate-600">{formatIST(timestamp)}</span>
    </div>
  );
}

export default function VendorOrderDetailPage() {
  const params = useParams<{ id: string | string[] }>();
  const queryClient = useQueryClient();
  const orderId = Array.isArray(params.id) ? params.id[0] : params.id;

  const orderQuery = useQuery({
    queryKey: ['vendor-order', orderId],
    queryFn: () => getVendorOrderById(orderId),
    enabled: Boolean(orderId),
  });

  const statusMutation = useMutation({
    mutationFn: (status: 'OUT_FOR_DELIVERY' | 'DELIVERED') =>
      updateOrderStatus(orderId, { status }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['vendor-order', orderId] }),
        queryClient.invalidateQueries({ queryKey: ['vendor-orders'] }),
      ]);
    },
  });

  if (!orderId) {
    return <ErrorMessage message="Invalid order ID" />;
  }

  if (orderQuery.isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-slate-700">
          <Spinner size="sm" />
          Loading order details...
        </div>
      </div>
    );
  }

  if (orderQuery.isError || !orderQuery.data) {
    return (
      <ErrorMessage
        message={getApiErrorMessage(orderQuery.error, 'Failed to load order details.')}
      />
    );
  }

  const order: OrderDetail = orderQuery.data;

  const handleStatusUpdate = (nextStatus: 'OUT_FOR_DELIVERY' | 'DELIVERED') => {
    const message =
      nextStatus === 'OUT_FOR_DELIVERY'
        ? 'Mark this order as Out for Delivery?'
        : 'Mark this order as Delivered?';

    if (!window.confirm(message)) {
      return;
    }

    statusMutation.mutate(nextStatus);
  };

  const buyerDisplay =
    'buyer' in order && order.buyer && typeof order.buyer === 'object'
      ? ((order.buyer as { name?: string | null; phone?: string | null }).name ??
        (order.buyer as { name?: string | null; phone?: string | null }).phone ??
        order.buyerId)
      : order.buyerId;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">Order #{order.id.slice(0, 10)}</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">₹{order.totalAmount}</h1>
          <p className="mt-1 text-sm text-slate-600">Created {formatIST(order.createdAt)}</p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusBadgeClasses(
            order.status,
          )}`}
        >
          {order.status}
        </span>
      </div>

      <ErrorMessage
        message={
          statusMutation.isError
            ? getApiErrorMessage(statusMutation.error, 'Failed to update order status.')
            : null
        }
      />

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Order Summary</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 p-3">
            <p className="text-slate-500">Buyer</p>
            <p className="mt-1 font-medium text-slate-900">{buyerDisplay}</p>
          </div>
          <div className="rounded-xl border border-slate-200 p-3">
            <p className="text-slate-500">Payment Method</p>
            <p className="mt-1 font-medium text-slate-900">
              {order.paymentMethod ?? 'N/A'}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 p-3">
            <p className="text-slate-500">Quote ID</p>
            <p className="mt-1 font-medium text-slate-900">{order.quoteId}</p>
          </div>
          <div className="rounded-xl border border-slate-200 p-3">
            <p className="text-slate-500">RFQ ID</p>
            <p className="mt-1 font-medium text-slate-900">{order.rfqId}</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Order Timeline</h2>
        <div className="mt-4 space-y-3">
          <TimelineRow label="Confirmed" timestamp={order.confirmedAt} />
          <TimelineRow label="Out for Delivery" timestamp={order.dispatchedAt} />
          <TimelineRow label="Delivered" timestamp={order.deliveredAt} />
          <TimelineRow label="Cancelled" timestamp={order.cancelledAt} />
          {!order.confirmedAt &&
          !order.dispatchedAt &&
          !order.deliveredAt &&
          !order.cancelledAt ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-600">
              No timeline timestamps available yet.
            </div>
          ) : null}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Status Actions</h2>
        <div className="mt-4">
          {order.status === 'CONFIRMED' ? (
            <button
              type="button"
              onClick={() => handleStatusUpdate('OUT_FOR_DELIVERY')}
              disabled={statusMutation.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {statusMutation.isPending ? (
                <Spinner size="sm" className="border-white/30 border-t-white" />
              ) : null}
              Mark as Out for Delivery
            </button>
          ) : null}

          {order.status === 'OUT_FOR_DELIVERY' ? (
            <button
              type="button"
              onClick={() => handleStatusUpdate('DELIVERED')}
              disabled={statusMutation.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {statusMutation.isPending ? (
                <Spinner size="sm" className="border-white/30 border-t-white" />
              ) : null}
              Mark as Delivered
            </button>
          ) : null}

          {order.status === 'DELIVERED' ? (
            <div className="inline-flex rounded-full bg-emerald-100 px-3 py-1.5 text-sm font-medium text-emerald-800">
              Delivered (no further actions)
            </div>
          ) : null}

          {order.status === 'CANCELLED' ? (
            <div className="inline-flex rounded-full bg-rose-100 px-3 py-1.5 text-sm font-medium text-rose-800">
              Cancelled (no further actions)
            </div>
          ) : null}
        </div>
      </section>

      <Link
        href="/vendor/orders"
        className="inline-flex rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
      >
        Back to Orders
      </Link>
    </div>
  );
}

