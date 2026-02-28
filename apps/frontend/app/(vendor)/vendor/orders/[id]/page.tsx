'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Truck, Package } from 'lucide-react';
import { getVendorOrderById, updateOrderStatus } from '@/lib/vendor-api';
import type { OrderDetail } from '@/lib/buyer-api';
import { getApiErrorMessage } from '@/lib/api';
import { formatIST } from '@/lib/utils/date';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { cn } from '@/lib/utils';

const pageV = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] } } };

function buildTimeline(order: OrderDetail) {
  const delivered = order.status === 'DELIVERED';
  const outForDelivery = order.status === 'OUT_FOR_DELIVERY' || delivered;
  return [
    { key: 'CONFIRMED', label: 'Order Confirmed', timestamp: order.confirmedAt, complete: true },
    { key: 'OUT_FOR_DELIVERY', label: 'Dispatched', timestamp: order.dispatchedAt, complete: outForDelivery },
    { key: 'DELIVERED', label: 'Delivered', timestamp: order.deliveredAt, complete: delivered },
  ];
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

  if (!orderId) return <EmptyState title="Invalid order ID" />;
  if (orderQuery.isLoading) return <div className="space-y-6"><SkeletonCard /><SkeletonCard /></div>;
  if (orderQuery.isError || !orderQuery.data) return <EmptyState title="Failed to load order" subtitle={getApiErrorMessage(orderQuery.error)} actionLabel="Back" actionHref="/vendor/orders" />;

  const order = orderQuery.data;
  const timeline = buildTimeline(order);

  return (
    <motion.div className="space-y-6" variants={pageV} initial="hidden" animate="visible">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="text-xs font-mono text-text-tertiary bg-elevated px-2 py-0.5 rounded">Order #{order.id.slice(0, 10)}</span>
          <h1 className="mt-2 text-3xl font-bold text-text-primary">₹{Number(order.totalAmount).toLocaleString('en-IN')}</h1>
          <p className="mt-1 text-sm text-text-secondary">Created {formatIST(order.createdAt)}</p>
        </div>
        <Badge status={order.status} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="card p-5">
            <h2 className="text-lg font-semibold text-text-primary mb-4">Order Timeline</h2>
            {order.status === 'CANCELLED' && (
              <div className="mb-4 rounded-xl bg-danger/10 border border-danger/20 px-4 py-3 text-sm text-danger">
                Cancelled{order.cancelledAt ? ` on ${formatIST(order.cancelledAt)}` : ''}{order.cancelReason ? ` · ${order.cancelReason}` : ''}
              </div>
            )}
            <ol className="space-y-0">
              {timeline.map((step, i) => (
                <li key={step.key} className="flex gap-3.5">
                  <div className="flex flex-col items-center">
                    <div className={cn('h-3 w-3 rounded-full mt-1', step.complete ? 'bg-success' : 'bg-border-strong')} />
                    {i < timeline.length - 1 && <div className={cn('w-0.5 flex-1 my-1 min-h-[32px]', step.complete ? 'bg-success' : 'bg-border-subtle')} />}
                  </div>
                  <div className="pb-4">
                    <p className={cn('text-sm font-medium', step.complete ? 'text-text-primary' : 'text-text-tertiary')}>{step.label}</p>
                    <p className="text-xs text-text-tertiary">{step.timestamp ? formatIST(step.timestamp) : 'Pending'}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <div>
          <div className="card p-5 sticky top-24 space-y-4">
            <h3 className="text-sm font-semibold text-text-primary">Actions</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-text-secondary">Total Amount</span><span className="font-semibold text-text-primary">₹{order.totalAmount}</span></div>
              <div className="flex justify-between"><span className="text-text-secondary">Buyer</span><span className="text-xs font-mono text-text-tertiary">#{order.buyerId.slice(0, 8)}</span></div>
            </div>

            {order.status === 'CONFIRMED' && (
              <Button className="w-full" loading={statusMutation.isPending} onClick={() => statusMutation.mutate('OUT_FOR_DELIVERY')}>
                <Truck className="h-4 w-4" />Mark Dispatched
              </Button>
            )}
            {order.status === 'OUT_FOR_DELIVERY' && (
              <Button className="w-full" loading={statusMutation.isPending} onClick={() => statusMutation.mutate('DELIVERED')}>
                <Package className="h-4 w-4" />Mark Delivered
              </Button>
            )}
            <Link href="/vendor/orders" className="block text-center text-sm font-medium text-text-secondary hover:text-text-primary transition-colors">
              ← Back to Orders
            </Link>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
