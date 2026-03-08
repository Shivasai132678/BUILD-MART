'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { getVendorOrderById, updateOrderStatus } from '@/lib/vendor-api';
import type { OrderDetail } from '@/lib/buyer-api';
import { getApiErrorMessage } from '@/lib/api';
import { formatIST } from '@/lib/utils/date';

function buildTimeline(order: OrderDetail) {
  const delivered = order.status === 'DELIVERED';
  const outForDelivery = order.status === 'OUT_FOR_DELIVERY' || delivered;
  return [
    { key: 'CONFIRMED', label: 'Order Confirmed', timestamp: order.confirmedAt, complete: true },
    { key: 'OUT_FOR_DELIVERY', label: 'Dispatched', timestamp: order.dispatchedAt, complete: outForDelivery },
    { key: 'DELIVERED', label: 'Delivered', timestamp: order.deliveredAt, complete: delivered },
  ];
}

function OrderStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    CONFIRMED: 'bg-[#3B7FC1]/15 text-[#60A5FA] border-[#3B7FC1]/30',
    OUT_FOR_DELIVERY: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
    DELIVERED: 'bg-green-500/15 text-green-400 border-green-500/30',
    CANCELLED: 'bg-red-500/15 text-red-400 border-red-500/30',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold border ${map[status] ?? 'bg-[#253347] text-[#8EA5C0]'}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

export default function VendorOrderDetailPage() {
  const params = useParams<{ id: string | string[] }>();
  const orderId = Array.isArray(params.id) ? params.id[0] : params.id;
  const queryClient = useQueryClient();

  const orderQuery = useQuery({ queryKey: ['vendor-order', orderId], queryFn: () => getVendorOrderById(orderId), enabled: Boolean(orderId) });

  const statusMutation = useMutation({
    mutationFn: (status: string) => updateOrderStatus(orderId, { status: status as 'OUT_FOR_DELIVERY' | 'DELIVERED' }),
    onSuccess: async () => { toast.success('Status updated!'); await queryClient.invalidateQueries({ queryKey: ['vendor-order', orderId] }); },
    onError: (error) => { toast.error(getApiErrorMessage(error)); },
  });

  if (!orderId) return (
    <div className="bg-[#1E2A3A] border border-[#253347] rounded-2xl p-12 text-center">
      <span className="material-symbols-outlined text-4xl text-[#4A6080]">error</span>
      <p className="mt-3 font-semibold text-[#E2EAF4]">Invalid order ID</p>
    </div>
  );

  if (orderQuery.isLoading) return (
    <div className="space-y-4">
      {[1, 2].map((i) => <div key={i} className="bg-[#1E2A3A] border border-[#253347] rounded-2xl h-36 animate-pulse" />)}
    </div>
  );

  if (orderQuery.isError || !orderQuery.data) return (
    <div className="bg-[#1E2A3A] border border-[#253347] rounded-2xl p-12 text-center">
      <span className="material-symbols-outlined text-4xl text-[#4A6080]">error</span>
      <p className="mt-3 font-semibold text-[#E2EAF4]">Failed to load order</p>
      <p className="mt-1 text-sm text-[#8EA5C0]">{orderQuery.error ? getApiErrorMessage(orderQuery.error) : 'Order not found'}</p>
      <Link href="/vendor/orders" className="mt-4 inline-block text-sm font-medium text-[#60A5FA] hover:underline">← Back to Orders</Link>
    </div>
  );

  const order = orderQuery.data;
  const timeline = buildTimeline(order);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="font-mono text-xs px-2 py-0.5 rounded bg-[#253347] text-[#4A6080]">Order #{order.id.slice(0, 10)}</span>
          <h1 className="mt-2 text-3xl font-bold text-[#E2EAF4]">₹{Number(order.totalAmount).toLocaleString('en-IN')}</h1>
          <p className="mt-1 text-sm text-[#8EA5C0]">Created {formatIST(order.createdAt)}</p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Timeline */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-[#1E2A3A] border border-[#253347] rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-[#E2EAF4] mb-4">Order Timeline</h2>

            {order.status === 'CANCELLED' && (
              <div className="mb-4 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
                Cancelled{order.cancelledAt ? ` on ${formatIST(order.cancelledAt)}` : ''}{order.cancelReason ? ` · ${order.cancelReason}` : ''}
              </div>
            )}

            <ol className="space-y-0">
              {timeline.map((step, i) => (
                <li key={step.key} className="flex gap-3.5">
                  <div className="flex flex-col items-center">
                    <div className={`h-3 w-3 rounded-full mt-1 ${step.complete ? 'bg-green-500' : 'bg-[#253347]'}`} />
                    {i < timeline.length - 1 && <div className={`w-0.5 flex-1 my-1 min-h-[32px] ${step.complete ? 'bg-green-500' : 'bg-[#253347]'}`} />}
                  </div>
                  <div className="pb-4">
                    <p className={`text-sm font-medium ${step.complete ? 'text-[#E2EAF4]' : 'text-[#4A6080]'}`}>{step.label}</p>
                    <p className="text-xs text-[#4A6080]">{step.timestamp ? formatIST(step.timestamp) : 'Pending'}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>

        {/* Actions Sidebar */}
        <div>
          <div className="bg-[#1E2A3A] border border-[#253347] rounded-2xl p-6 sticky top-24 space-y-4">
            <h3 className="text-sm font-semibold text-[#E2EAF4]">Actions</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-[#8EA5C0]">Total Amount</span>
                <span className="font-semibold text-[#E2EAF4]">₹{Number(order.totalAmount).toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8EA5C0]">Buyer</span>
                <span className="text-xs font-mono text-[#4A6080]">#{order.buyerId.slice(0, 8)}</span>
              </div>
            </div>

            {order.status === 'CONFIRMED' && (
              <button
                disabled={statusMutation.isPending}
                onClick={() => statusMutation.mutate('OUT_FOR_DELIVERY')}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm bg-[#3B7FC1] hover:bg-[#2B6FAF] text-white transition-all disabled:opacity-60"
              >
                <span className="material-symbols-outlined text-[18px]">local_shipping</span>
                {statusMutation.isPending ? 'Updating…' : 'Mark Dispatched'}
              </button>
            )}

            {order.status === 'OUT_FOR_DELIVERY' && (
              <button
                disabled={statusMutation.isPending}
                onClick={() => statusMutation.mutate('DELIVERED')}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm bg-green-600 hover:bg-green-700 text-white transition-all disabled:opacity-60"
              >
                <span className="material-symbols-outlined text-[18px]">inventory</span>
                {statusMutation.isPending ? 'Updating…' : 'Mark Delivered'}
              </button>
            )}

            <Link href="/vendor/orders" className="block text-center text-sm font-medium text-[#8EA5C0] hover:text-[#E2EAF4] transition-colors">
              ← Back to Orders
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
