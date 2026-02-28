'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { toast } from 'sonner';
import { Edit3, X, Save } from 'lucide-react';
import { getApiErrorMessage } from '@/lib/api';
import { formatIST } from '@/lib/utils/date';
import {
  getVendorProfile,
  type UpdateVendorProfilePayload,
  updateVendorProfile,
} from '@/lib/vendor-profile-api';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { MotionContainer } from '@/components/ui/Motion';

const gstNumberRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

const optionalUrlSchema = z
  .union([z.string().trim().url('Enter a valid URL').min(1), z.literal('')])
  .optional();

const profileSchema = z.object({
  businessName: z.string().trim().min(1, 'Business name is required'),
  gstNumber: z.string().trim().regex(gstNumberRegex, 'Enter a valid GST number'),
  city: z.string().trim().min(1, 'City is required'),
  serviceableAreas: z.string().trim().min(1, 'At least one serviceable area is required'),
  gstDocumentUrl: optionalUrlSchema,
  businessLicenseUrl: optionalUrlSchema,
});

type ProfileFormValues = z.infer<typeof profileSchema>;

function splitServiceableAreas(raw: string): string[] {
  return Array.from(
    new Set(raw.split(',').map((v) => v.trim()).filter((v) => v.length > 0)),
  );
}

function buildDefaultValues(profile: {
  businessName: string;
  gstNumber: string;
  city: string;
  serviceableAreas: string[];
  gstDocumentUrl?: string | null;
  businessLicenseUrl?: string | null;
}): ProfileFormValues {
  return {
    businessName: profile.businessName,
    gstNumber: profile.gstNumber,
    city: profile.city,
    serviceableAreas: profile.serviceableAreas.join(', '),
    gstDocumentUrl: profile.gstDocumentUrl ?? '',
    businessLicenseUrl: profile.businessLicenseUrl ?? '',
  };
}

const inputClassName =
  'w-full h-10 rounded-xl border border-border bg-elevated px-4 text-sm text-text-primary placeholder:text-text-tertiary outline-none transition-all duration-200 focus:border-accent focus:ring-2 focus:ring-accent/20';

export default function VendorProfilePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);

  const profileQuery = useQuery({
    queryKey: ['vendor-profile'],
    queryFn: getVendorProfile,
    retry: false,
  });

  const initialValues = useMemo(
    () =>
      profileQuery.data
        ? buildDefaultValues(profileQuery.data)
        : { businessName: '', gstNumber: '', city: '', serviceableAreas: '', gstDocumentUrl: '', businessLicenseUrl: '' },
    [profileQuery.data],
  );

  const {
    register,
    reset,
    setError,
    clearErrors,
    handleSubmit,
    formState: { errors },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: initialValues,
  });

  useEffect(() => {
    if (profileQuery.data) {
      reset(buildDefaultValues(profileQuery.data));
      return;
    }
    if (axios.isAxiosError(profileQuery.error) && profileQuery.error.response?.status === 404) {
      router.replace('/vendor/onboarding');
    }
  }, [profileQuery.data, profileQuery.error, reset, router]);

  const updateMutation = useMutation({
    mutationFn: updateVendorProfile,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['vendor-profile'] });
      setIsEditing(false);
      clearErrors('root');
      toast.success('Profile updated successfully!');
    },
    onError: (error) => {
      setError('root', { type: 'server', message: getApiErrorMessage(error, 'Failed to update profile.') });
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    clearErrors('root');
    const payload: UpdateVendorProfilePayload = {
      businessName: values.businessName.trim(),
      gstNumber: values.gstNumber.trim().toUpperCase(),
      city: values.city.trim(),
      serviceableAreas: splitServiceableAreas(values.serviceableAreas),
      ...(values.gstDocumentUrl?.trim() ? { gstDocumentUrl: values.gstDocumentUrl.trim() } : { gstDocumentUrl: undefined }),
      ...(values.businessLicenseUrl?.trim() ? { businessLicenseUrl: values.businessLicenseUrl.trim() } : { businessLicenseUrl: undefined }),
    };
    await updateMutation.mutateAsync(payload);
  });

  if (profileQuery.isLoading) {
    return <div className="space-y-6"><SkeletonCard /><SkeletonCard /></div>;
  }

  if (profileQuery.isError || !profileQuery.data) {
    return <EmptyState title="Failed to load profile" subtitle={getApiErrorMessage(profileQuery.error)} />;
  }

  const profile = profileQuery.data;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <MotionContainer>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-text-primary tracking-tight">Vendor Profile</h1>
            <p className="mt-1 text-sm text-text-secondary">Manage your business details.</p>
          </div>
          <Badge status={profile.isApproved ? 'APPROVED' : 'PENDING'} />
        </div>
      </MotionContainer>

      {!isEditing ? (
        <MotionContainer delay={0.1}>
          <div className="card p-5 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <InfoItem label="Business Name" value={profile.businessName} />
              <InfoItem label="GST Number" value={profile.gstNumber} />
              <InfoItem label="City" value={profile.city} />
              <InfoItem label="Serviceable Areas" value={profile.serviceableAreas.join(', ') || 'N/A'} />
              <InfoItem label="GST Document" value={profile.gstDocumentUrl ?? 'Not provided'} />
              <InfoItem label="Business License" value={profile.businessLicenseUrl ?? 'Not provided'} />
              <InfoItem label="Created" value={formatIST(profile.createdAt)} />
              <InfoItem label="Last Updated" value={formatIST(profile.updatedAt)} />
            </div>
            <Button variant="secondary" onClick={() => setIsEditing(true)}>
              <Edit3 className="h-4 w-4" />
              Edit Profile
            </Button>
          </div>
        </MotionContainer>
      ) : (
        <MotionContainer delay={0.1}>
          <form onSubmit={onSubmit} className="card p-5 space-y-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField id="businessName" label="Business Name" error={errors.businessName?.message}>
                <input id="businessName" className={inputClassName} {...register('businessName')} />
              </FormField>
              <FormField id="gstNumber" label="GST Number" error={errors.gstNumber?.message}>
                <input id="gstNumber" className={`${inputClassName} uppercase`} {...register('gstNumber')} />
              </FormField>
              <FormField id="city" label="City" error={errors.city?.message}>
                <input id="city" className={inputClassName} {...register('city')} />
              </FormField>
              <FormField id="serviceableAreas" label="Serviceable Areas (comma separated)" error={errors.serviceableAreas?.message}>
                <input id="serviceableAreas" className={inputClassName} {...register('serviceableAreas')} />
              </FormField>
              <FormField id="gstDocumentUrl" label="GST Document URL" error={errors.gstDocumentUrl?.message}>
                <input id="gstDocumentUrl" className={inputClassName} {...register('gstDocumentUrl')} />
              </FormField>
              <FormField id="businessLicenseUrl" label="Business License URL" error={errors.businessLicenseUrl?.message}>
                <input id="businessLicenseUrl" className={inputClassName} {...register('businessLicenseUrl')} />
              </FormField>
            </div>

            {errors.root && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errors.root.message}</div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button type="submit" loading={updateMutation.isPending}>
                <Save className="h-4 w-4" />
                {updateMutation.isPending ? 'Saving…' : 'Save'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  reset(initialValues);
                  clearErrors('root');
                  setIsEditing(false);
                }}
              >
                <X className="h-4 w-4" />
                Cancel
              </Button>
            </div>
          </form>
        </MotionContainer>
      )}
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-elevated border border-border-subtle p-3">
      <p className="text-xs text-text-tertiary">{label}</p>
      <p className="mt-1 text-sm font-medium text-text-primary break-all">{value}</p>
    </div>
  );
}

function FormField({ id, label, error, children }: { id: string; label: string; error?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-text-primary" htmlFor={id}>{label}</label>
      {children}
      {error && <p className="text-xs text-accent-danger">{error}</p>}
    </div>
  );
}
