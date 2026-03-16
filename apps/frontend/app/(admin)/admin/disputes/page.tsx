'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { getAdminDisputes, resolveAdminDispute, type AdminDispute } from '@/lib/admin-api';
import { getApiErrorMessage } from '@/lib/api';
import { formatIST } from '@/lib/utils/date';
import { formatINR } from '@/lib/utils/money';
import { PageTransition, StaggerContainer, StaggerItem } from '@/components/ui/Motion';

const STATUS_FILTERS = ['ALL', 'OPEN', 'RESOLVED', 'CLOSED'] as const;
type FilterValue = typeof STATUS_FILTERS[number];

function DisputeStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    OPEN: 'bg-orange-500/15 text-orange-400 border border-orange-500/30',
    RESOLVED: 'bg-green-500/15 text-green-400 border border-green-500/30',
    CLOSED: 'bg-[#1E2238] text-[#4A5A80] border border-[#1E2238]',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${map[status] ?? ''}`}>
      {status}
    </span>
  );
}

type ResolveModal = { open: true; dispute: AdminDispute } | { open: false };

export default function AdminDisputesPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<FilterValue>('ALL');
  const [resolveModal, setResolveModal] = useState<ResolveModal>({ open: false });
  const [adminNotes, setAdminNotes] = useState('');
  const [resolveStatus, setResolveStatus] = useState<'RESOLVED' | 'CLOSED'>('RESOLVED');

  const disputesQuery = useQuery({
    queryKey: ['admin-disputes', statusFilter],
    queryFn: () => getAdminDisputes(50, 0, statusFilter === 'ALL' ? undefined : statusFilter),
  });

  const resolveMutation = useMutation({
    mutationFn: ({ id }: { id: string }) =>
      resolveAdminDispute(id, { adminNotes: adminNotes.trim() || undefined, status: resolveStatus }),
    onSuccess: () => {
      toast.success('Dispute updated.');
      setResolveModal({ open: false });
      setAdminNotes('');
      void queryClient.invalidateQueries({ queryKey: ['admin-disputes'] });
    },
    onError: (error) => { toast.error(getApiErrorMessage(error, 'Failed to update dispute.')); },
  });

  const disputes: AdminDispute[] = disputesQuery.data?.items ?? [];
  const total = disputesQuery.data?.total ?? 0;

  const openCount = disputes.filter((d) => d.status === 'OPEN').length;

  return (
    <PageTransition className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[#F5F0E8]">Dispute Management</h1>
          <p className="text-sm text-[#8A9BC0] mt-1">
            {total} dispute{total !== 1 ? 's' : ''}
            {openCount > 0 && <span className="ml-2 text-orange-400 font-medium">· {openCount} open</span>}
          </p>
        </div>
      </div>

      {/* Status filters */}
      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setStatusFilter(f)}
            className={`px-4 py-1.5 rounded-xl text-sm font-medium transition-colors ${
              statusFilter === f
                ? 'bg-[#6764f2] text-white'
                : 'bg-[#12152A] text-[#8A9BC0] hover:text-[#F5F0E8] border border-[#1E2238]'
            }`}
          >
            {f === 'ALL' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {/* List */}
      {disputesQuery.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-[#12152A] border border-[#1E2238] rounded-2xl h-24 animate-pulse" />
          ))}
        </div>
      ) : disputes.length === 0 ? (
        <div className="bg-[#12152A] border border-[#1E2238] rounded-2xl flex flex-col items-center justify-center py-20 text-center px-6">
          <span className="material-symbols-outlined text-[56px] text-[#1E2238] mb-4">report_problem</span>
          <p className="font-medium text-[#F5F0E8]">No disputes</p>
          <p className="text-sm text-[#8A9BC0] mt-1">
            {statusFilter === 'ALL' ? 'No disputes have been filed.' : `No ${statusFilter.toLowerCase()} disputes.`}
          </p>
        </div>
      ) : (
        <StaggerContainer className="space-y-3">
          {disputes.map((dispute) => (
            <StaggerItem key={dispute.id}>
              <div className="bg-[#12152A] border border-[#1E2238] rounded-2xl p-5 hover:border-[#6764f2]/30 transition-all">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className="font-mono text-xs text-[#4A5A80]">
                        Order #{dispute.order?.referenceCode ?? dispute.orderId.slice(0, 10)}
                      </span>
                      <DisputeStatusBadge status={dispute.status} />
                      {dispute.order?.totalAmount && (
                        <span className="text-xs font-semibold text-[#F5F0E8]">
                          {formatINR(dispute.order.totalAmount)}
                        </span>
                      )}
                    </div>
                    <p className="font-semibold text-[#F5F0E8]">{dispute.reason}</p>
                    <p className="mt-1 text-sm text-[#8A9BC0] line-clamp-2">{dispute.description}</p>
                    <div className="mt-2 flex flex-wrap gap-4 text-xs text-[#4A5A80]">
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[12px]">person</span>
                        Buyer: #{dispute.buyerId.slice(0, 8)}
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[12px]">storefront</span>
                        Vendor: #{dispute.vendorId.slice(0, 8)}
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[12px]">calendar_today</span>
                        {formatIST(dispute.createdAt)}
                      </span>
                    </div>
                    {dispute.adminNotes && (
                      <div className="mt-2 bg-[#1E2238] rounded-xl px-3 py-2 text-xs text-[#8A9BC0]">
                        <span className="font-semibold text-[#4A5A80]">Admin notes: </span>
                        {dispute.adminNotes}
                      </div>
                    )}
                  </div>

                  {dispute.status === 'OPEN' && (
                    <button
                      type="button"
                      onClick={() => { setResolveModal({ open: true, dispute }); setAdminNotes(''); setResolveStatus('RESOLVED'); }}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium bg-[#6764f2]/15 hover:bg-[#6764f2]/25 text-[#6764f2] border border-[#6764f2]/30 transition-colors shrink-0"
                    >
                      <span className="material-symbols-outlined text-[16px]">gavel</span>
                      Resolve
                    </button>
                  )}
                </div>
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>
      )}

      {/* Resolve modal */}
      <AnimatePresence>
        {resolveModal.open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              transition={{ duration: 0.25 }}
              className="bg-[#12152A] border border-[#1E2238] rounded-2xl p-6 w-full max-w-md shadow-2xl"
            >
              <div className="flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-[#6764f2] text-[20px]">gavel</span>
                <h2 className="text-base font-bold text-[#F5F0E8]">Resolve Dispute</h2>
              </div>
              <p className="text-sm text-[#8A9BC0] mb-4">
                Dispute: <span className="font-medium text-[#F5F0E8]">{resolveModal.dispute.reason}</span>
              </p>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-[#4A5A80] uppercase tracking-wide mb-1.5">Resolution</label>
                  <div className="flex gap-2">
                    {(['RESOLVED', 'CLOSED'] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setResolveStatus(s)}
                        className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${
                          resolveStatus === s
                            ? s === 'RESOLVED'
                              ? 'bg-green-500/20 text-green-400 border-green-500/30'
                              : 'bg-[#1E2238] text-[#8A9BC0] border-[#253347]'
                            : 'bg-[#0C0F1A] text-[#4A5A80] border-[#1E2238] hover:border-[#253347]'
                        }`}
                      >
                        {s === 'RESOLVED' ? 'Resolved' : 'Closed'}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#4A5A80] uppercase tracking-wide mb-1.5">Admin Notes (optional)</label>
                  <textarea
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="Add notes for the buyer and vendor…"
                    rows={3}
                    className="w-full rounded-xl border border-[#1E2238] bg-[#0C0F1A] px-3 py-2.5 text-sm text-[#F5F0E8] placeholder:text-[#4A5A80] outline-none focus:border-[#6764f2] focus:ring-2 focus:ring-[#6764f2]/20 resize-none transition-all"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-5">
                <button
                  type="button"
                  onClick={() => setResolveModal({ open: false })}
                  disabled={resolveMutation.isPending}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-[#8A9BC0] hover:text-[#F5F0E8] border border-[#1E2238] bg-[#0C0F1A] transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={resolveMutation.isPending}
                  onClick={() => resolveModal.open && resolveMutation.mutate({ id: resolveModal.dispute.id })}
                  className="px-4 py-2 rounded-xl text-sm font-semibold bg-[#6764f2]/20 text-[#6764f2] hover:bg-[#6764f2]/30 border border-[#6764f2]/30 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  {resolveMutation.isPending && (
                    <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>
                  )}
                  Confirm
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </PageTransition>
  );
}
