'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { Check, MapPin, Calendar, X } from 'lucide-react';
import { getApiErrorMessage } from '@/lib/api';
import { approveVendor, getPendingVendors, rejectVendor, type PendingVendorProfile } from '@/lib/admin-api';
import { formatIST } from '@/lib/utils/date';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonRow } from '@/components/ui/Skeleton';
import { MotionContainer, StaggerContainer, StaggerItem } from '@/components/ui/Motion';

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
  const pendingVendors = vendors.filter((v) => v.isApproved === false);

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
    <div className="space-y-6">
      <MotionContainer>
        <PageHeader
          title="Vendor Approvals"
          subtitle="Review pending vendor onboarding applications."
        />
      </MotionContainer>

      {vendorsEndpointMissing && (
        <MotionContainer delay={0.05}>
          <div className="rounded-2xl bg-amber-50 border border-amber-200 px-5 py-4 text-sm text-amber-800">
            The pending vendor list endpoint is not available. The approval action is wired, but the queue depends on a backend endpoint.
          </div>
        </MotionContainer>
      )}

      {pendingVendorsQuery.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)}
        </div>
      ) : !vendorsEndpointMissing && pendingVendors.length === 0 ? (
        <EmptyState
          title="All caught up!"
          subtitle="No pending vendor approvals at the moment."
        />
      ) : !vendorsEndpointMissing && pendingVendors.length > 0 ? (
        <StaggerContainer className="space-y-3">
          {pendingVendors.map((vendor) => (
            <StaggerItem key={vendor.id}>
              <div className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-base font-semibold text-text-primary">{vendor.businessName}</p>
                      <Badge status="PENDING" />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-3 text-sm text-text-secondary">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {vendor.city}
                      </span>
                      <span>GST: {vendor.gstNumber}</span>
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {formatIST(vendor.createdAt)}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      loading={approveVendorMutation.isPending && approveVendorMutation.variables === vendor.id}
                      disabled={isMutating}
                      onClick={() => openApproveDialog(vendor.id, vendor.businessName)}
                    >
                      <Check className="h-4 w-4" />
                      Approve
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      loading={rejectVendorMutation.isPending && rejectVendorMutation.variables?.id === vendor.id}
                      disabled={isMutating}
                      onClick={() => openRejectDialog(vendor.id, vendor.businessName)}
                    >
                      <X className="h-4 w-4" />
                      Reject
                    </Button>
                  </div>
                </div>
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>
      ) : null}

      {/* Approve confirmation dialog */}
      <ConfirmDialog
        open={dialog.type === 'approve'}
        onClose={closeDialog}
        onConfirm={() => { if (dialog.type === 'approve') approveVendorMutation.mutate(dialog.id); }}
        title={dialog.type === 'approve' ? `Approve ${dialog.businessName}?` : ''}
        description="This vendor will be able to receive RFQs and submit quotes."
        confirmLabel="Approve"
        variant="primary"
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
          <label htmlFor="reject-reason" className="block text-sm font-medium text-text-primary">
            Reason (optional)
          </label>
          <textarea
            id="reject-reason"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Enter a reason for rejection…"
            rows={3}
            disabled={rejectVendorMutation.isPending}
            className="w-full rounded-xl border border-border bg-elevated px-4 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary transition-all duration-200 focus:ring-2 focus:ring-accent/20 focus:border-accent focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed resize-none"
          />
        </div>
      </ConfirmDialog>
    </div>
  );
}
