'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { fetchBuyerOrders, type Order } from '@/lib/buyer-api';
import { formatIST } from '@/lib/utils/date';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonRow } from '@/components/ui/Skeleton';
import { cn } from '@/lib/utils';

const pageV = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] } } };
const listV = { visible: { transition: { staggerChildren: 0.07 } } };
const itemV = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] } } };

const STATUS_FILTERS: Array<{ label: string; value: Order['status'] | '' }> = [
  { label: 'All', value: '' }, { label: 'Confirmed', value: 'CONFIRMED' },
  { label: 'In Transit', value: 'OUT_FOR_DELIVERY' }, { label: 'Delivered', value: 'DELIVERED' },
  { label: 'Cancelled', value: 'CANCELLED' },
];

export default function BuyerOrdersPage() {
  const [statusFilter, setStatusFilter] = useState<Order['status'] | ''>('');
  const ordersQuery = useQuery({ queryKey: ['buyer-orders', 'list', statusFilter], queryFn: () => fetchBuyerOrders(20, 0, statusFilter || undefined) });
  const items = ordersQuery.data?.items ?? [];
  const total = ordersQuery.data?.total ?? 0;

  return (
    <motion.div className="space-y-6" variants={pageV} initial="hidden" animate="visible">
      <PageHeader title="My Orders" subtitle={`${total} orders total`} action={<Link href="/buyer/rfq/new"><Button size="sm"><Plus className="h-4 w-4" />Create RFQ</Button></Link>} />

      <div className="flex gap-2 overflow-x-auto pb-1">
        {STATUS_FILTERS.map((f) => (
          <button key={f.value} type="button" onClick={() => setStatusFilter(f.value)}
            className={cn('shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-all', statusFilter === f.value ? 'bg-accent/15 text-accent' : 'text-text-secondary hover:text-text-primary hover:bg-elevated border border-border-subtle')}>
            {f.label}
          </button>
        ))}
      </div>

      {ordersQuery.isLoading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}</div>
      ) : items.length === 0 ? (
        <EmptyState title="No orders found" subtitle="Accept a vendor quote to create your first order." actionLabel="Create RFQ" actionHref="/buyer/rfq/new" />
      ) : (
        <motion.div className="space-y-3" variants={listV} initial="hidden" animate="visible">
          {items.map((order) => (
            <motion.div key={order.id} variants={itemV}>
              <Link href={`/buyer/orders/${order.id}`} className="card flex items-center justify-between gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-text-tertiary bg-elevated px-2 py-0.5 rounded">#{order.id.slice(0, 10)}</span>
                    <Badge status={order.status} />
                  </div>
                  <p className="mt-1 text-sm text-text-secondary">Vendor #{order.vendorId.slice(0, 8)} · {formatIST(order.createdAt)}</p>
                </div>
                <p className="text-lg font-bold text-text-primary">₹{order.totalAmount}</p>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      )}
    </motion.div>
  );
}
