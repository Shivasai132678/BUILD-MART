'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/api';
import { approveVendor, getPendingVendors, rejectVendor, type PendingVendorProfile } from '@/lib/admin-api';
import { formatIST } from '@/lib/utils/date';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

type DialogState =
  | { type: 'closed' }
  | { type: 'approve'; id: string; businessName: string }
  | { type: 'reject'; id: string; businessName: string };

export default function AdminVendorsPage() {
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState<DialogState>({ type: 'closed' });
  const [rejectReason, setRejectReason] = useState('');

  const pendingVendorsQuery = useQuery({
    queryKey: ['admin-pending-vendors'],
    queryFn: getPendingVendors,
    retry: false,
  });

  const approveVendorMutation = useMutation({
    mutationFn: (id: string) => approveVendor(id),
    onSuccess: async () => {
      toast.success('Vendor approved successfully!');
      setDialog({ type: 'closed' });
      await queryClient.invalidateQueries({ queryKey: ['admin-pending-vendors'] });
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Failed to approve vendor.'));
    },
  });

  const rejectVendorMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => rejectVendor(id, reason),
    onSuccess: async () => {
      toast.success('Vendor rejected.');
      setDialog({ type: 'closed' });
      setRejectReason('');
      await queryClient.invalidateQueries({ queryKey: ['admin-pending-vendors'] });
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Failed to reject vendor.'));
    },
  });

  const isMutating = approveVendorMutation.isPending || rejectVendorMutation.isPending;

  const vendorsEndpointMissing = pendingVendorsQuery.isError;
  const vendors: PendingVendorProfile[] = pendingVendorsQuery.data?.data ?? [];
  const pendingVendors = vendors.filter((v) => v.status === 'PENDING');

  const openApproveDialog = (id: string, businessName: string) => {
    setDialog({ type: 'approve', id, businessName });
  };

  const openRejectDialog = (id: string, businessName: string) => {
    setRejectReason('');
    setDialog({ type: 'reject', id, businessName });
  };

  const closeDialog = () => {
    if (!isMutating) {
      setDialog({ type: 'closed' });
      setRejectReason('');
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#F5F0E8]">Vendor Approvals</h1>
        <p className="text-[#8A9BC0] text-sm mt-1">Review and manage pending vendor onboarding applications</p>
      </div>

      {/* Error alert */}
      {vendorsEndpointMissing && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl px-5 py-4 flex items-center gap-3">
          <span className="material-symbols-outlined text-amber-400 text-[20px]">warning</span>
          <p className="text-sm text-[#F5F0E8]">The pending vendor list endpoint is not available. The approval action is wired, but the queue depends on a backend endpoint.</p>
        </div>
      )}

      {/* List */}
      {pendingVendorsQuery.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-[#12152A] border border-[#1E2238] rounded-2xl h-24 animate-pulse" />
          ))}
        </div>
      ) : !vendorsEndpointMissing && pendingVendors.length === 0 ? (
        <div className="bg-[#12152A] border border-[#1E2238] rounded-2xl flex flex-col items-center justify-center py-20 text-center px-6">
          <span className="material-symbols-outlined text-[56px] text-[#1E2238] mb-4">verified_user</span>
          <p className="text-base font-medium text-[#F5F0E8]">All caught up!</p>
          <p className="text-sm text-[#8A9BC0] mt-1">No pending vendor approvals at the moment.</p>
        </div>
      ) : !vendorsEndpointMissing && pendingVendors.length > 0 ? (
        <div className="space-y-3">
          {pendingVendors.map((vendor) => (
            <div key={vendor.id} className="bg-[#12152A] border border-[#1E2238] rounded-2xl p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <p className="text-base font-semibold text-[#F5F0E8]">{vendor.businessName}</p>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                      Pending
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm text-[#8A9BC0]">
                    <span className="inline-flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">location_on</span>
                      {vendor.city}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">receipt</span>
                      GST: {vendor.gstNumber}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                      {formatIST(vendor.createdAt)}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => openApproveDialog(vendor.id, vendor.businessName)}
                    disabled={isMutating}
                    className="inline-flex items-center gap-1.5 bg-green-500/15 hover:bg-green-500/25 text-green-400 border border-green-500/30 hover:border-green-500/50 px-3 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {approveVendorMutation.isPending && approveVendorMutation.variables === vendor.id ? (
                      <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                    ) : (
                      <span className="material-symbols-outlined text-[16px]">check_circle</span>
                    )}
                    Approve
                  </button>
                  <button
                    onClick={() => openRejectDialog(vendor.id, vendor.businessName)}
                    disabled={isMutating}
                    className="inline-flex items-center gap-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 hover:border-red-500/40 px-3 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {rejectVendorMutation.isPending && rejectVendorMutation.variables?.id === vendor.id ? (
                      <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                    ) : (
                      <span className="material-symbols-outlined text-[16px]">cancel</span>
                    )}
                    Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {/* Approve confirmation dialog */}
      <ConfirmDialog
        open={dialog.type === 'approve'}
        onClose={closeDialog}
        onConfirm={() => { if (dialog.type === 'approve') approveVendorMutation.mutate(dialog.id); }}
        title={dialog.type === 'approve' ? `Approve ${dialog.businessName}?` : ''}
        description="This vendor will be able to receive RFQs and submit quotes."
        confirmLabel="Approve"
        variant="admin"
        loading={approveVendorMutation.isPending}
      />

      {/* Reject dialog with optional reason */}
      <ConfirmDialog
        open={dialog.type === 'reject'}
        onClose={closeDialog}
        onConfirm={() => { if (dialog.type === 'reject') rejectVendorMutation.mutate({ id: dialog.id, reason: rejectReason || undefined }); }}
        title={dialog.type === 'reject' ? `Reject ${dialog.businessName}?` : ''}
        description="The vendor application will be rejected."
        confirmLabel="Reject"
        variant="danger"
        loading={rejectVendorMutation.isPending}
      >
        <div className="space-y-1.5">
          <label htmlFor="reject-reason" className="block text-sm font-medium text-[#F5F0E8]">
            Reason (optional)
          </label>
          <textarea
            id="reject-reason"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Enter a reason for rejection…"
            rows={3}
            disabled={rejectVendorMutation.isPending}
            className="w-full rounded-xl border border-[#1E2238] bg-[#0C0F1A] px-4 py-2.5 text-sm text-[#F5F0E8] placeholder:text-[#4A5A80] transition-all focus:ring-2 focus:ring-[#6764f2]/20 focus:border-[#6764f2] focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed resize-none"
          />
        </div>
      </ConfirmDialog>
    </div>
  );
}

