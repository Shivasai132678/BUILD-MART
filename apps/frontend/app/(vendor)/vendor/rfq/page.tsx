'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { RefreshCw, ArrowRight } from 'lucide-react';
import { getAvailableRfqs } from '@/lib/vendor-api';
import { formatIST } from '@/lib/utils/date';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonRow } from '@/components/ui/Skeleton';

const pageV = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] } } };
const listV = { visible: { transition: { staggerChildren: 0.07 } } };
const itemV = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] } } };

const PAGE_SIZE = 20;

export default function VendorRfqListPage() {
  const rfqsQuery = useQuery({ queryKey: ['vendor-available-rfqs'], queryFn: () => getAvailableRfqs(PAGE_SIZE, 0), refetchInterval: 30_000 });
  const items = rfqsQuery.data?.items ?? [];
  const total = rfqsQuery.data?.total ?? 0;

  return (
    <motion.div className="space-y-6" variants={pageV} initial="hidden" animate="visible">
      <PageHeader title="Available RFQs" subtitle={`${total} open requests${rfqsQuery.isFetching ? ' · Refreshing…' : ''}`}
        action={rfqsQuery.isFetching ? <span className="flex items-center gap-1.5 text-xs text-text-tertiary"><RefreshCw className="h-3 w-3 animate-spin" />Refreshing</span> : undefined}
      />

      {rfqsQuery.isLoading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}</div>
      ) : items.length === 0 ? (
        <EmptyState title="No open RFQs" subtitle="New RFQs matching your profile will appear here automatically." />
      ) : (
        <motion.div className="space-y-3" variants={listV} initial="hidden" animate="visible">
          {items.map((rfq) => (
            <motion.div key={rfq.id} variants={itemV}>
              <Link href={`/vendor/rfq/${rfq.id}`} className="card flex items-center justify-between gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-text-tertiary bg-elevated px-2 py-0.5 rounded">#{rfq.id.slice(0, 8)}</span>
                    <Badge status={rfq.status} />
                  </div>
                  <p className="mt-1 text-sm text-text-secondary">{rfq.city} · {rfq.items.length} item{rfq.items.length === 1 ? '' : 's'} · {formatIST(rfq.createdAt)}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-text-tertiary" />
              </Link>
            </motion.div>
          ))}
        </motion.div>
      )}
    </motion.div>
  );
}
