'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { getVendorOrders } from '@/lib/vendor-api';
import { formatIST } from '@/lib/utils/date';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonRow } from '@/components/ui/Skeleton';

const pageV = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] } } };
const listV = { visible: { transition: { staggerChildren: 0.07 } } };
const itemV = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] } } };

export default function VendorOrdersPage() {
  const ordersQuery = useQuery({ queryKey: ['vendor-orders'], queryFn: () => getVendorOrders(20, 0) });
  const items = ordersQuery.data?.items ?? [];
  const total = ordersQuery.data?.total ?? 0;

  return (
    <motion.div className="space-y-6" variants={pageV} initial="hidden" animate="visible">
      <PageHeader title="My Orders" subtitle={`${total} orders total`} />

      {ordersQuery.isLoading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}</div>
      ) : items.length === 0 ? (
        <EmptyState title="No orders yet" subtitle="Orders will appear here when buyers accept your quotes." />
      ) : (
        <motion.div className="space-y-3" variants={listV} initial="hidden" animate="visible">
          {items.map((order) => (
            <motion.div key={order.id} variants={itemV}>
              <Link href={`/vendor/orders/${order.id}`} className="card flex items-center justify-between gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-text-tertiary bg-elevated px-2 py-0.5 rounded">#{order.id.slice(0, 10)}</span>
                    <Badge status={order.status} />
                  </div>
                  <p className="mt-1 text-sm text-text-secondary">{formatIST(order.createdAt)}</p>
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
