'use client';

import { useQueries, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { FileText, ShoppingBag, Truck, Package, Plus, BookOpen, ArrowRight } from 'lucide-react';
import { fetchBuyerOrders, fetchBuyerRfqs } from '@/lib/buyer-api';
import { formatIST } from '@/lib/utils/date';
import { useUserStore } from '@/store/user.store';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonStatCard, SkeletonRow } from '@/components/ui/Skeleton';

const pageVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] } },
};
const listVariants = { visible: { transition: { staggerChildren: 0.07, delayChildren: 0.1 } } };
const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] } },
};

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function BuyerDashboardPage() {
  const user = useUserStore((s) => s.user);

  const recentRfqsQuery = useQuery({
    queryKey: ['buyer-rfqs', 'recent'],
    queryFn: () => fetchBuyerRfqs(5, 0),
  });

  const orderCountQueries = useQueries({
    queries: [
      { queryKey: ['buyer-orders', 'confirmed-count'], queryFn: () => fetchBuyerOrders(1, 0, 'CONFIRMED') },
      { queryKey: ['buyer-orders', 'ofd-count'], queryFn: () => fetchBuyerOrders(1, 0, 'OUT_FOR_DELIVERY') },
      { queryKey: ['buyer-orders', 'delivered-count'], queryFn: () => fetchBuyerOrders(1, 0, 'DELIVERED') },
    ],
  });

  const isLoadingStats = recentRfqsQuery.isLoading || orderCountQueries.some((q) => q.isLoading);
  const rfqTotal = recentRfqsQuery.data?.total ?? 0;
  const confirmedCount = orderCountQueries[0]?.data?.total ?? 0;
  const outForDeliveryCount = orderCountQueries[1]?.data?.total ?? 0;
  const deliveredCount = orderCountQueries[2]?.data?.total ?? 0;
  const activeOrders = confirmedCount + outForDeliveryCount;

  return (
    <motion.div className="space-y-8" variants={pageVariants} initial="hidden" animate="visible">
      <PageHeader
        title={`${getGreeting()}, ${user?.name ?? 'there'}`}
        subtitle="Here's what's happening with your orders"
      />

      {isLoadingStats ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonStatCard key={i} />)}
        </div>
      ) : (
        <motion.div className="grid grid-cols-2 lg:grid-cols-4 gap-4" variants={listVariants} initial="hidden" animate="visible">
          <motion.div variants={itemVariants}><StatCard icon={FileText} label="Active RFQs" value={rfqTotal} iconColorClass="bg-accent/10 text-accent" /></motion.div>
          <motion.div variants={itemVariants}><StatCard icon={ShoppingBag} label="Quotes Received" value={confirmedCount} iconColorClass="bg-success/10 text-success" /></motion.div>
          <motion.div variants={itemVariants}><StatCard icon={Truck} label="Orders In Progress" value={activeOrders} iconColorClass="bg-purple/10 text-purple" /></motion.div>
          <motion.div variants={itemVariants}><StatCard icon={Package} label="Delivered" value={deliveredCount} iconColorClass="bg-warning/10 text-warning" /></motion.div>
        </motion.div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { href: '/buyer/rfq/new', icon: Plus, label: 'New RFQ', subtitle: 'Request quotes from vendors', color: 'bg-accent/10 text-accent group-hover:bg-accent group-hover:text-white' },
          { href: '/buyer/catalog', icon: BookOpen, label: 'Browse Catalog', subtitle: 'Explore available products', color: 'bg-purple/10 text-purple group-hover:bg-purple group-hover:text-white' },
          { href: '/buyer/orders', icon: Package, label: 'View Orders', subtitle: 'Track your active orders', color: 'bg-success/10 text-success group-hover:bg-success group-hover:text-base' },
        ].map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="group card flex items-center gap-4 p-4"
          >
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${action.color}`}>
              <action.icon className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-text-primary">{action.label}</p>
              <p className="text-xs text-text-tertiary">{action.subtitle}</p>
            </div>
            <ArrowRight className="h-4 w-4 text-text-tertiary group-hover:text-accent transition-colors" />
          </Link>
        ))}
      </div>

      {/* Recent RFQs */}
      <section className="card p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-text-primary">Recent RFQs</h2>
          <span className="text-sm text-text-tertiary">{rfqTotal} total</span>
        </div>

        {recentRfqsQuery.isLoading ? (
          <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)}</div>
        ) : recentRfqsQuery.data && recentRfqsQuery.data.items.length > 0 ? (
          <motion.div className="space-y-2" variants={listVariants} initial="hidden" animate="visible">
            {recentRfqsQuery.data.items.map((rfq) => (
              <motion.div key={rfq.id} variants={itemVariants}>
                <Link
                  href={`/buyer/rfq/${rfq.id}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border-subtle px-4 py-3 transition-all duration-200 hover:bg-elevated hover:border-border"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-text-tertiary bg-elevated px-2 py-0.5 rounded">
                        #{rfq.id.slice(0, 8)}
                      </span>
                      <Badge status={rfq.status} />
                    </div>
                    <p className="mt-1 text-xs text-text-tertiary truncate">
                      {rfq.city} · {rfq.items.length} item{rfq.items.length === 1 ? '' : 's'} · {formatIST(rfq.createdAt)}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-text-tertiary flex-shrink-0" />
                </Link>
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <EmptyState title="No RFQs yet" subtitle="Create your first RFQ to start receiving vendor quotes." actionLabel="Create RFQ" actionHref="/buyer/rfq/new" />
        )}
      </section>
    </motion.div>
  );
}
