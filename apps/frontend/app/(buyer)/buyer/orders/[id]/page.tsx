'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { Spinner } from '@/components/ui/Spinner';
import { cancelBuyerOrder, fetchBuyerOrder, type OrderDetail } from '@/lib/buyer-api';
import { getApiErrorMessage } from '@/lib/api';
import { formatIST } from '@/lib/utils/date';

type TimelineStep = {
  key: 'CONFIRMED' | 'OUT_FOR_DELIVERY' | 'DELIVERED';
  label: string;
  timestamp: string | null | undefined;
  complete: boolean;
};

function getStatusBadgeClasses(status: OrderDetail['status']): string {
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

function buildTimeline(order: OrderDetail): TimelineStep[] {
  const deliveredOrBeyond = order.status === 'DELIVERED';
  const outForDeliveryOrBeyond =
    order.status === 'OUT_FOR_DELIVERY' || order.status === 'DELIVERED';

  return [
    {
      key: 'CONFIRMED',
      label: 'Confirmed',
      timestamp: order.confirmedAt,
      complete: true,
    },
    {
      key: 'OUT_FOR_DELIVERY',
      label: 'Out for delivery',
      timestamp: order.dispatchedAt,
      complete: outForDeliveryOrBeyond,
    },
    {
      key: 'DELIVERED',
      label: 'Delivered',
      timestamp: order.deliveredAt,
      complete: deliveredOrBeyond,
    },
  ];
}

export default function BuyerOrderDetailPage() {
  const params = useParams<{ id: string | string[] }>();
  const queryClient = useQueryClient();
  const orderId = Array.isArray(params.id) ? params.id[0] : params.id;

  const orderQuery = useQuery({
    queryKey: ['buyer-order', orderId],
    queryFn: () => fetchBuyerOrder(orderId),
    enabled: Boolean(orderId),
  });

  const cancelOrderMutation = useMutation({
    mutationFn: () => cancelBuyerOrder(orderId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['buyer-order', orderId] }),
        queryClient.invalidateQueries({ queryKey: ['buyer-orders'] }),
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
          Loading order...
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

  const order = orderQuery.data;
  const timeline = buildTimeline(order);
  const canCancel = order.status === 'CONFIRMED';

  const handleCancel = () => {
    const confirmed = window.confirm('Are you sure you want to cancel this order?');
    if (!confirmed) {
      return;
    }

    cancelOrderMutation.mutate();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">Order #{order.id.slice(0, 10)}</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">
            ₹{order.totalAmount}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Created {formatIST(order.createdAt)}
          </p>
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
          cancelOrderMutation.isError
            ? getApiErrorMessage(cancelOrderMutation.error, 'Failed to cancel order.')
            : null
        }
      />

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Order Timeline</h2>

        {order.status === 'CANCELLED' ? (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            Cancelled {order.cancelledAt ? `on ${formatIST(order.cancelledAt)}` : ''}
            {order.cancelReason ? ` • Reason: ${order.cancelReason}` : ''}
          </div>
        ) : null}

        <ol className="mt-4 space-y-4">
          {timeline.map((step, index) => (
            <li key={step.key} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span
                  className={`mt-0.5 h-3 w-3 rounded-full ${
                    step.complete ? 'bg-slate-900' : 'bg-slate-300'
                  }`}
                />
                {index < timeline.length - 1 ? (
                  <span className="mt-1 h-8 w-px bg-slate-200" />
                ) : null}
              </div>
              <div>
                <p
                  className={`text-sm font-medium ${
                    step.complete ? 'text-slate-900' : 'text-slate-500'
                  }`}
                >
                  {step.label}
                </p>
                <p className="text-xs text-slate-500">
                  {step.timestamp ? formatIST(step.timestamp) : 'Pending'}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Order Details</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 p-3">
            <p className="text-slate-500">RFQ ID</p>
            <p className="mt-1 font-medium text-slate-900">{order.rfqId}</p>
          </div>
          <div className="rounded-xl border border-slate-200 p-3">
            <p className="text-slate-500">Quote ID</p>
            <p className="mt-1 font-medium text-slate-900">{order.quoteId}</p>
          </div>
          <div className="rounded-xl border border-slate-200 p-3">
            <p className="text-slate-500">Vendor ID</p>
            <p className="mt-1 font-medium text-slate-900">{order.vendorId}</p>
          </div>
          <div className="rounded-xl border border-slate-200 p-3">
            <p className="text-slate-500">Payment Method</p>
            <p className="mt-1 font-medium text-slate-900">
              {order.paymentMethod ?? 'N/A'}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Payment Status</h2>
        {order.payment ? (
          <div className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="text-slate-500">Status</p>
              <p className="mt-1 font-medium text-slate-900">{order.payment.status}</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="text-slate-500">Amount</p>
              <p className="mt-1 font-medium text-slate-900">
                ₹{order.payment.amount}
              </p>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-600">
            No payment record linked yet.
          </p>
        )}
      </section>

      <div className="flex flex-wrap gap-3">
        {canCancel ? (
          <button
            type="button"
            onClick={handleCancel}
            disabled={cancelOrderMutation.isPending}
            className="inline-flex items-center gap-2 rounded-lg border border-rose-300 bg-white px-4 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {cancelOrderMutation.isPending ? <Spinner size="sm" /> : null}
            {cancelOrderMutation.isPending ? 'Cancelling...' : 'Cancel Order'}
          </button>
        ) : null}

        <Link
          href="/buyer/orders"
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
        >
          Back to Orders
        </Link>
      </div>
    </div>
  );
}

