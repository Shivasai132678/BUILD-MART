'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchMyDisputes, type Dispute } from '@/lib/buyer-api';
import { getApiErrorMessage } from '@/lib/api';
import { formatIST } from '@/lib/utils/date';
import { formatINR } from '@/lib/utils/money';
import { PageTransition, StaggerContainer, StaggerItem } from '@/components/ui/Motion';
import Link from 'next/link';

const STATUS_FILTERS = ['ALL', 'OPEN', 'RESOLVED', 'CLOSED'] as const;

function DisputeStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    OPEN: 'bg-orange-500/15 text-orange-400 border border-orange-500/30',
    RESOLVED: 'bg-green-500/15 text-green-400 border border-green-500/30',
    CLOSED: 'bg-[#3A3027]/50 text-[#7A7067] border border-[#3A3027]',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${map[status] ?? 'bg-[#3A3027]/50 text-[#A89F91]'}`}>
      {status}
    </span>
  );
}

export default function BuyerDisputesPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<typeof STATUS_FILTERS[number]>('ALL');

  const disputesQuery = useQuery({
    queryKey: ['buyer-disputes', statusFilter],
    queryFn: () => fetchMyDisputes(20, 0, statusFilter === 'ALL' ? undefined : statusFilter),
  });

  const disputes: Dispute[] = disputesQuery.data?.items ?? [];
  const total = disputesQuery.data?.total ?? 0;

  return (
    <PageTransition className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[#F5F0E8]">My Disputes</h1>
          <p className="text-sm text-[#A89F91] mt-0.5">
            {total} dispute{total !== 1 ? 's' : ''} · Issues reported on your orders
          </p>
        </div>
        <Link
          href="/buyer/orders"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[#A89F91] hover:text-[#F5F0E8] border border-[#2A2520] bg-[#1A1714] px-3 py-2 rounded-xl transition-all"
        >
          <span className="material-symbols-outlined text-[16px]">local_shipping</span>
          My Orders
        </Link>
      </div>

      {/* Status filters */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setStatusFilter(f)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-all ${
              statusFilter === f
                ? 'bg-[#D97706]/15 text-[#F59E0B] border border-[#D97706]/20'
                : 'text-[#A89F91] hover:text-[#F5F0E8] hover:bg-[#2A2520] border border-[#2A2520]'
            }`}
          >
            {f === 'ALL' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {/* Content */}
      {disputesQuery.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-[#1A1714] border border-[#2A2520] rounded-2xl h-24 animate-pulse" />
          ))}
        </div>
      ) : disputes.length === 0 ? (
        <div className="bg-[#1A1714] border border-dashed border-[#2A2520] rounded-2xl p-16 text-center">
          <span className="material-symbols-outlined text-5xl text-[#3A3027]">report_problem</span>
          <p className="mt-3 font-semibold text-[#F5F0E8]">No disputes found</p>
          <p className="mt-1 text-sm text-[#A89F91]">
            {statusFilter === 'ALL'
              ? 'You have not filed any disputes. Use "Report an Issue" on a delivered order.'
              : `No ${statusFilter.toLowerCase()} disputes.`}
          </p>
        </div>
      ) : (
        <StaggerContainer className="space-y-3">
          {disputes.map((dispute) => (
            <StaggerItem key={dispute.id}>
              <div className="bg-[#1A1714] border border-[#2A2520] hover:border-[#3A3027] rounded-2xl p-5 transition-all">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-mono text-xs text-[#7A7067]">
                        Order #{dispute.order?.referenceCode ?? dispute.orderId.slice(0, 10)}
                      </span>
                      <DisputeStatusBadge status={dispute.status} />
                    </div>
                    <p className="font-semibold text-[#F5F0E8] truncate">{dispute.reason}</p>
                    <p className="mt-1 text-sm text-[#A89F91] line-clamp-2">{dispute.description}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-[#7A7067]">Filed</p>
                    <p className="text-xs text-[#A89F91]">{formatIST(dispute.createdAt)}</p>
                    {dispute.order?.totalAmount && (
                      <p className="mt-1 text-sm font-semibold text-[#F5F0E8]">
                        {formatINR(dispute.order.totalAmount)}
                      </p>
                    )}
                  </div>
                </div>

                {dispute.adminNotes && (
                  <div className="mt-3 bg-[#211E19] border border-[#2A2520] rounded-xl px-4 py-3 text-sm">
                    <p className="text-xs font-semibold text-[#7A7067] uppercase tracking-wide mb-1">Admin Notes</p>
                    <p className="text-[#A89F91]">{dispute.adminNotes}</p>
                  </div>
                )}

                {dispute.resolvedAt && (
                  <p className="mt-2 text-xs text-green-400 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[13px]">check_circle</span>
                    Resolved on {formatIST(dispute.resolvedAt)}
                  </p>
                )}
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>
      )}
    </PageTransition>
  );
}
