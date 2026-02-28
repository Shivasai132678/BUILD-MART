'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { FileText, Package, DollarSign, AlertCircle, ArrowRight } from 'lucide-react';
import { getAvailableRfqs, getVendorOrders } from '@/lib/vendor-api';
import { getVendorProfile } from '@/lib/vendor-profile-api';
import { formatIST } from '@/lib/utils/date';
import { useUserStore } from '@/store/user.store';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonStatCard, SkeletonRow } from '@/components/ui/Skeleton';

const pageV = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] } } };
const listV = { visible: { transition: { staggerChildren: 0.07, delayChildren: 0.1 } } };
const itemV = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] } } };

export default function VendorDashboardPage() {
  const user = useUserStore((s) => s.user);
  const profileQuery = useQuery({ queryKey: ['vendor-profile'], queryFn: getVendorProfile, retry: false });
  const rfqsQuery = useQuery({ queryKey: ['vendor-available-rfqs-dash'], queryFn: () => getAvailableRfqs(5, 0) });
  const ordersQuery = useQuery({ queryKey: ['vendor-orders-dash'], queryFn: () => getVendorOrders(1, 0) });

  const isApproved = profileQuery.data?.isApproved ?? false;
  const rfqTotal = rfqsQuery.data?.total ?? 0;
  const orderTotal = ordersQuery.data?.total ?? 0;
  const recentRfqs = rfqsQuery.data?.items ?? [];
  const isLoadingStats = rfqsQuery.isLoading || ordersQuery.isLoading || profileQuery.isLoading;

  return (
    <motion.div className="space-y-8" variants={pageV} initial="hidden" animate="visible">
      <PageHeader title={`Welcome, ${user?.name ?? 'Vendor'}`} subtitle="Manage your vendor business" />

      {!isApproved && !profileQuery.isLoading && (
        <div className="rounded-2xl bg-warning/10 border border-warning/20 px-5 py-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
          <div><p className="text-sm font-semibold text-text-primary">Pending Approval</p><p className="text-sm text-text-secondary mt-0.5">Your vendor profile is under review. RFQs will appear once approved.</p></div>
        </div>
      )}

      {isLoadingStats ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">{Array.from({ length: 3 }).map((_, i) => <SkeletonStatCard key={i} />)}</div>
      ) : (
        <motion.div className="grid grid-cols-2 lg:grid-cols-3 gap-4" variants={listV} initial="hidden" animate="visible">
          <motion.div variants={itemV}><StatCard icon={FileText} label="Available RFQs" value={rfqTotal} iconColorClass="bg-accent/10 text-accent" /></motion.div>
          <motion.div variants={itemV}><StatCard icon={Package} label="Total Orders" value={orderTotal} iconColorClass="bg-purple/10 text-purple" /></motion.div>
          <motion.div variants={itemV}><StatCard icon={DollarSign} label="Status" value={isApproved ? 'Approved' : 'Pending'} iconColorClass={isApproved ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'} /></motion.div>
        </motion.div>
      )}

      <div className="card p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-text-primary">Recent RFQs</h2>
          <Link href="/vendor/rfq" className="text-sm text-accent hover:text-accent-hover transition-colors font-medium">View all →</Link>
        </div>
        {rfqsQuery.isLoading ? (
          <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)}</div>
        ) : recentRfqs.length > 0 ? (
          <motion.div className="space-y-2" variants={listV} initial="hidden" animate="visible">
            {recentRfqs.map((rfq) => (
              <motion.div key={rfq.id} variants={itemV}>
                <Link href={`/vendor/rfq/${rfq.id}`} className="flex items-center justify-between gap-3 rounded-xl border border-border-subtle px-4 py-3 transition-all hover:bg-elevated hover:border-border">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-text-tertiary bg-elevated px-2 py-0.5 rounded">#{rfq.id.slice(0, 8)}</span>
                      <Badge status={rfq.status} />
                    </div>
                    <p className="mt-1 text-xs text-text-tertiary">{rfq.city} · {rfq.items.length} item{rfq.items.length === 1 ? '' : 's'} · {formatIST(rfq.createdAt)}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-text-tertiary" />
                </Link>
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <EmptyState title="No available RFQs" subtitle="New RFQs matching your profile will appear here." />
        )}
      </div>
    </motion.div>
  );
}
