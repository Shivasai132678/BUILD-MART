'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/api';
import {
  getAllVendors,
  updateVendorStatus,
  bulkApproveVendors,
  bulkSuspendVendors,
  type AdminVendorProfile,
  type VendorStatusValue,
} from '@/lib/admin-api';
import { formatIST } from '@/lib/utils/date';

const STATUS_STYLES: Record<string, string> = {
  APPROVED:  'bg-green-500/15 text-green-400 border border-green-500/30',
  PENDING:   'bg-amber-500/15 text-amber-400 border border-amber-500/30',
  REJECTED:  'bg-red-500/10 text-red-400 border border-red-500/20',
  SUSPENDED: 'bg-orange-500/10 text-orange-400 border border-orange-500/20',
};

const FILTERS: Array<{ label: string; value: VendorStatusValue | 'ALL' }> = [
  { label: 'All', value: 'ALL' },
  { label: 'Pending', value: 'PENDING' },
  { label: 'Approved', value: 'APPROVED' },
  { label: 'Rejected', value: 'REJECTED' },
  { label: 'Suspended', value: 'SUSPENDED' },
];

type ConfirmState =
  | { open: false }
  | { open: true; vendor: AdminVendorProfile; nextStatus: VendorStatusValue };

type BulkConfirm =
  | { open: false }
  | { open: true; action: 'approve' | 'suspend'; count: number };

export default function AdminVendorsPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<VendorStatusValue | 'ALL'>('ALL');
  const [confirm, setConfirm] = useState<ConfirmState>({ open: false });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkConfirm, setBulkConfirm] = useState<BulkConfirm>({ open: false });

  const vendorsQuery = useQuery({
    queryKey: ['admin-all-vendors', statusFilter],
    queryFn: () =>
      getAllVendors(100, 0, statusFilter === 'ALL' ? undefined : statusFilter),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: VendorStatusValue }) =>
      updateVendorStatus(id, status),
    onSuccess: (_, variables) => {
      toast.success(`Vendor ${variables.status.toLowerCase()} successfully.`);
      setConfirm({ open: false });
      void queryClient.invalidateQueries({ queryKey: ['admin-all-vendors'] });
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Failed to update vendor status.'));
    },
  });

  const bulkApproveMutation = useMutation({
    mutationFn: (ids: string[]) => bulkApproveVendors(ids),
    onSuccess: (data) => {
      toast.success(`${data.approved} vendor${data.approved !== 1 ? 's' : ''} approved.`);
      setSelectedIds(new Set());
      setBulkConfirm({ open: false });
      void queryClient.invalidateQueries({ queryKey: ['admin-all-vendors'] });
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Bulk approve failed.'));
    },
  });

  const bulkSuspendMutation = useMutation({
    mutationFn: (ids: string[]) => bulkSuspendVendors(ids),
    onSuccess: (data) => {
      toast.success(`${data.suspended} vendor${data.suspended !== 1 ? 's' : ''} suspended.`);
      setSelectedIds(new Set());
      setBulkConfirm({ open: false });
      void queryClient.invalidateQueries({ queryKey: ['admin-all-vendors'] });
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Bulk suspend failed.'));
    },
  });

  const vendors: AdminVendorProfile[] = vendorsQuery.data?.items ?? [];
  const allSelected = vendors.length > 0 && vendors.every((v) => selectedIds.has(v.id));
  const someSelected = selectedIds.size > 0;

  function toggleVendor(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(vendors.map((v) => v.id)));
    }
  }

  const openConfirm = (vendor: AdminVendorProfile, nextStatus: VendorStatusValue) => {
    setConfirm({ open: true, vendor, nextStatus });
  };

  function handleBulkAction(action: 'approve' | 'suspend') {
    setBulkConfirm({ open: true, action, count: selectedIds.size });
  }

  function confirmBulkAction() {
    if (!bulkConfirm.open) return;
    const ids = Array.from(selectedIds);
    if (bulkConfirm.action === 'approve') {
      bulkApproveMutation.mutate(ids);
    } else {
      bulkSuspendMutation.mutate(ids);
    }
  }

  const ACTION_BUTTONS: Record<
    string,
    Array<{ label: string; nextStatus: VendorStatusValue; cls: string; icon: string }>
  > = {
    PENDING: [
      { label: 'Approve', nextStatus: 'APPROVED', icon: 'check_circle', cls: 'bg-green-500/15 hover:bg-green-500/25 text-green-400 border border-green-500/30' },
      { label: 'Reject',  nextStatus: 'REJECTED',  icon: 'cancel',       cls: 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20' },
    ],
    APPROVED: [
      { label: 'Suspend', nextStatus: 'SUSPENDED', icon: 'block',        cls: 'bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/20' },
      { label: 'Reject',  nextStatus: 'REJECTED',  icon: 'cancel',       cls: 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20' },
    ],
    REJECTED: [
      { label: 'Approve', nextStatus: 'APPROVED', icon: 'check_circle',  cls: 'bg-green-500/15 hover:bg-green-500/25 text-green-400 border border-green-500/30' },
    ],
    SUSPENDED: [
      { label: 'Restore', nextStatus: 'APPROVED', icon: 'restart_alt',   cls: 'bg-green-500/15 hover:bg-green-500/25 text-green-400 border border-green-500/30' },
      { label: 'Reject',  nextStatus: 'REJECTED',  icon: 'cancel',       cls: 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20' },
    ],
  };

  const ACTION_LABELS: Record<VendorStatusValue, string> = {
    APPROVED:  'approve',
    REJECTED:  'reject',
    SUSPENDED: 'suspend',
    PENDING:   'set to pending',
  };

  const isBulkPending = bulkApproveMutation.isPending || bulkSuspendMutation.isPending;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#F5F0E8]">Vendor Management</h1>
        <p className="text-[#8A9BC0] text-sm mt-1">
          View all vendors and manage their status. Changes take effect immediately.
        </p>
      </div>

      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-2 items-center">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => { setStatusFilter(f.value); setSelectedIds(new Set()); }}
            className={`px-4 py-1.5 rounded-xl text-sm font-medium transition-colors ${
              statusFilter === f.value
                ? 'bg-[#6764f2] text-white'
                : 'bg-[#12152A] text-[#8A9BC0] hover:text-[#F5F0E8] border border-[#1E2238]'
            }`}
          >
            {f.label}
          </button>
        ))}
        <span className="ml-auto text-xs text-[#4A5A80] self-center">
          {vendorsQuery.data?.total ?? 0} vendor{(vendorsQuery.data?.total ?? 0) !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Bulk action toolbar — only when selection exists */}
      {someSelected && (
        <div className="flex items-center gap-3 px-4 py-3 bg-[#1A1D35] border border-[#6764f2]/30 rounded-2xl">
          <span className="text-sm text-[#F5F0E8] font-medium">
            {selectedIds.size} vendor{selectedIds.size !== 1 ? 's' : ''} selected
          </span>
          <div className="ml-auto flex gap-2">
            <button
              onClick={() => handleBulkAction('approve')}
              disabled={isBulkPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium bg-green-500/15 hover:bg-green-500/25 text-green-400 border border-green-500/30 transition-colors disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[16px]">check_circle</span>
              Bulk Approve
            </button>
            <button
              onClick={() => handleBulkAction('suspend')}
              disabled={isBulkPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/20 transition-colors disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[16px]">block</span>
              Bulk Suspend
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="px-3 py-1.5 rounded-xl text-sm text-[#8A9BC0] hover:text-[#F5F0E8] border border-[#1E2238] transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {vendorsQuery.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-[#12152A] border border-[#1E2238] rounded-2xl h-24 animate-pulse" />
          ))}
        </div>
      ) : vendors.length === 0 ? (
        <div className="bg-[#12152A] border border-[#1E2238] rounded-2xl flex flex-col items-center justify-center py-20 text-center px-6">
          <span className="material-symbols-outlined text-[56px] text-[#1E2238] mb-4">store</span>
          <p className="text-base font-medium text-[#F5F0E8]">No vendors found</p>
          <p className="text-sm text-[#8A9BC0] mt-1">
            {statusFilter === 'ALL' ? 'No vendors have registered yet.' : `No vendors with status "${statusFilter}".`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Select all row */}
          <div className="flex items-center gap-3 px-2">
            <input
              type="checkbox"
              id="select-all"
              checked={allSelected}
              onChange={toggleAll}
              className="w-4 h-4 rounded accent-[#6764f2] cursor-pointer"
            />
            <label htmlFor="select-all" className="text-xs text-[#8A9BC0] cursor-pointer select-none">
              Select all ({vendors.length})
            </label>
          </div>

          {vendors.map((vendor) => {
            const actions = ACTION_BUTTONS[vendor.status] ?? [];
            const isChecked = selectedIds.has(vendor.id);
            const isMutatingThis =
              statusMutation.isPending &&
              confirm.open &&
              confirm.vendor.id === vendor.id;

            return (
              <div
                key={vendor.id}
                className={`bg-[#12152A] border rounded-2xl p-5 transition-colors ${
                  isChecked ? 'border-[#6764f2]/40 bg-[#6764f2]/5' : 'border-[#1E2238]'
                }`}
              >
                <div className="flex flex-wrap items-start gap-4">
                  {/* Checkbox */}
                  <div className="flex items-start pt-0.5">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleVendor(vendor.id)}
                      className="w-4 h-4 rounded accent-[#6764f2] cursor-pointer"
                      aria-label={`Select ${vendor.businessName}`}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <p className="text-base font-semibold" style={{ color: '#F5F0E8' }}>{vendor.businessName}</p>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${STATUS_STYLES[vendor.status] ?? ''}`}>
                        {vendor.status.charAt(0) + vendor.status.slice(1).toLowerCase()}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-[#C8D0E0]">
                      <span className="inline-flex items-center gap-1 text-[#F5F0E8] font-medium">
                        <span className="material-symbols-outlined text-[14px] font-normal">person</span>
                        {vendor.user?.name ?? '—'}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">phone</span>
                        {vendor.user?.phone ?? '—'}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">location_on</span>
                        {vendor.city}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">receipt</span>
                        {vendor.gstNumber}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                        {formatIST(vendor.createdAt)}
                      </span>
                    </div>
                  </div>

                  {/* Per-vendor action buttons */}
                  {actions.length > 0 && (
                    <div className="flex gap-2">
                      {actions.map((action) => (
                        <button
                          key={action.nextStatus}
                          onClick={() => openConfirm(vendor, action.nextStatus)}
                          disabled={isMutatingThis}
                          className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${action.cls}`}
                        >
                          <span className="material-symbols-outlined text-[16px]">{action.icon}</span>
                          {action.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Per-vendor confirmation overlay */}
      {confirm.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#12152A] border border-[#1E2238] rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-base font-bold text-[#F5F0E8] mb-2">
              {confirm.nextStatus === 'APPROVED' && confirm.vendor.status === 'SUSPENDED' ? 'Restore' : ''}
              {confirm.nextStatus === 'APPROVED' && confirm.vendor.status !== 'SUSPENDED' ? 'Approve' : ''}
              {confirm.nextStatus === 'SUSPENDED' ? 'Suspend' : ''}
              {confirm.nextStatus === 'REJECTED' ? 'Reject' : ''}{' '}
              {confirm.vendor.businessName}?
            </h2>
            <p className="text-sm text-[#8A9BC0] mb-6">
              {confirm.nextStatus === 'APPROVED'
                ? 'This vendor will be able to receive RFQs and submit quotes.'
                : confirm.nextStatus === 'SUSPENDED'
                  ? 'The vendor will lose access to submit quotes and browse RFQs immediately.'
                  : 'The vendor will lose selling access and be notified of this change.'}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirm({ open: false })}
                disabled={statusMutation.isPending}
                className="px-4 py-2 rounded-xl text-sm font-medium text-[#8A9BC0] hover:text-[#F5F0E8] border border-[#1E2238] bg-[#0C0F1A] transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  confirm.open &&
                  statusMutation.mutate({ id: confirm.vendor.id, status: confirm.nextStatus })
                }
                disabled={statusMutation.isPending}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-1.5 ${
                  confirm.nextStatus === 'APPROVED'
                    ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/30'
                    : 'bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/25'
                }`}
              >
                {statusMutation.isPending && (
                  <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                )}
                Confirm {ACTION_LABELS[confirm.nextStatus]}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk action confirmation overlay */}
      {bulkConfirm.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#12152A] border border-[#1E2238] rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-base font-bold text-[#F5F0E8] mb-2">
              Bulk {bulkConfirm.action === 'approve' ? 'Approve' : 'Suspend'} {bulkConfirm.count} Vendor{bulkConfirm.count !== 1 ? 's' : ''}?
            </h2>
            <p className="text-sm text-[#8A9BC0] mb-6">
              {bulkConfirm.action === 'approve'
                ? `${bulkConfirm.count} vendor${bulkConfirm.count !== 1 ? 's' : ''} will be approved and can start receiving RFQs immediately.`
                : `${bulkConfirm.count} vendor${bulkConfirm.count !== 1 ? 's' : ''} will be suspended and lose access immediately.`}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setBulkConfirm({ open: false })}
                disabled={isBulkPending}
                className="px-4 py-2 rounded-xl text-sm font-medium text-[#8A9BC0] hover:text-[#F5F0E8] border border-[#1E2238] bg-[#0C0F1A] transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmBulkAction}
                disabled={isBulkPending}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-1.5 ${
                  bulkConfirm.action === 'approve'
                    ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/30'
                    : 'bg-orange-500/15 text-orange-400 hover:bg-orange-500/25 border border-orange-500/25'
                }`}
              >
                {isBulkPending && (
                  <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                )}
                Confirm {bulkConfirm.action === 'approve' ? 'Approve' : 'Suspend'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
