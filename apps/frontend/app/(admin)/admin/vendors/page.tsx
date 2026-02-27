'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { Spinner } from '@/components/ui/Spinner';
import { getApiErrorMessage } from '@/lib/api';
import {
  approveVendor,
  getPendingVendors,
  type PendingVendorProfile,
} from '@/lib/admin-api';
import { formatIST } from '@/lib/utils/date';

export default function AdminVendorsPage() {
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);

  const pendingVendorsQuery = useQuery({
    queryKey: ['admin-pending-vendors'],
    queryFn: getPendingVendors,
    retry: false,
  });

  const approveVendorMutation = useMutation({
    mutationFn: (id: string) => approveVendor(id),
    onSuccess: async () => {
      setActionError(null);
      await queryClient.invalidateQueries({ queryKey: ['admin-pending-vendors'] });
    },
    onError: (error) => {
      setActionError(getApiErrorMessage(error, 'Failed to approve vendor.'));
    },
  });

  if (pendingVendorsQuery.isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-slate-700">
          <Spinner size="sm" />
          Loading pending vendors...
        </div>
      </div>
    );
  }

  const vendorsEndpointMissing = pendingVendorsQuery.isError;
  const vendors: PendingVendorProfile[] = pendingVendorsQuery.data?.items ?? [];

  const handleApprove = (id: string, businessName: string) => {
    const confirmed = window.confirm(`Approve ${businessName}?`);
    if (!confirmed) {
      return;
    }

    approveVendorMutation.mutate(id);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Vendor Approvals</h1>
        <p className="mt-1 text-sm text-slate-600">
          Review pending vendor onboarding applications and approve them.
        </p>
      </div>

      {vendorsEndpointMissing ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Pending vendor list endpoint is not available yet. Approval action is wired, but the
          queue list depends on a backend list endpoint.
        </div>
      ) : null}

      <ErrorMessage
        message={
          pendingVendorsQuery.isError
            ? getApiErrorMessage(
                pendingVendorsQuery.error,
                'Failed to load pending vendors.',
              )
            : null
        }
      />
      <ErrorMessage message={actionError} />

      {!vendorsEndpointMissing && vendors.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-600">
          No pending vendor approvals
        </div>
      ) : null}

      {!vendorsEndpointMissing && vendors.length > 0 ? (
        <div className="space-y-3">
          {vendors
            .filter((vendor) => vendor.isApproved === false)
            .map((vendor) => (
              <div
                key={vendor.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-900">{vendor.businessName}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      GST: {vendor.gstNumber} • {vendor.city}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Applied: {formatIST(vendor.createdAt)}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleApprove(vendor.id, vendor.businessName)}
                    disabled={approveVendorMutation.isPending}
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {approveVendorMutation.isPending ? (
                      <Spinner size="sm" className="border-white/30 border-t-white" />
                    ) : null}
                    Approve
                  </button>
                </div>
              </div>
            ))}
        </div>
      ) : null}
    </div>
  );
}
