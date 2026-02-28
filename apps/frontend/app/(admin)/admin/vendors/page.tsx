'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { Check, MapPin, Calendar } from 'lucide-react';
import { getApiErrorMessage } from '@/lib/api';
import { approveVendor, getPendingVendors, type PendingVendorProfile } from '@/lib/admin-api';
import { formatIST } from '@/lib/utils/date';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonRow } from '@/components/ui/Skeleton';
import { MotionContainer, StaggerContainer, StaggerItem } from '@/components/ui/Motion';

export default function AdminVendorsPage() {
  const queryClient = useQueryClient();

  const pendingVendorsQuery = useQuery({
    queryKey: ['admin-pending-vendors'],
    queryFn: getPendingVendors,
    retry: false,
  });

  const approveVendorMutation = useMutation({
    mutationFn: (id: string) => approveVendor(id),
    onSuccess: async () => {
      toast.success('Vendor approved successfully!');
      await queryClient.invalidateQueries({ queryKey: ['admin-pending-vendors'] });
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Failed to approve vendor.'));
    },
  });

  const vendorsEndpointMissing = pendingVendorsQuery.isError;
  const vendors: PendingVendorProfile[] = pendingVendorsQuery.data?.data ?? [];
  const pendingVendors = vendors.filter((v) => v.isApproved === false);

  const handleApprove = (id: string, businessName: string) => {
    if (!window.confirm(`Approve ${businessName}?`)) return;
    approveVendorMutation.mutate(id);
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
                  <Button
                    variant="primary"
                    size="sm"
                    loading={approveVendorMutation.isPending && approveVendorMutation.variables === vendor.id}
                    disabled={approveVendorMutation.isPending}
                    onClick={() => handleApprove(vendor.id, vendor.businessName)}
                  >
                    <Check className="h-4 w-4" />
                    Approve
                  </Button>
                </div>
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>
      ) : null}
    </div>
  );
}
