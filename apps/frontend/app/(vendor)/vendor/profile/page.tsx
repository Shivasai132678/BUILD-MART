'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/api';
import { formatIST } from '@/lib/utils/date';
import {
  getVendorProfile,
  type UpdateVendorProfilePayload,
  updateVendorProfile,
} from '@/lib/vendor-profile-api';

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
  'w-full h-10 rounded-xl border border-[#1E3A5F] bg-[#1E2A3A] px-4 text-sm text-[#E8F0F8] placeholder:text-[#4A6080] outline-none transition-all focus:border-[#3B7FC1] focus:ring-2 focus:ring-[#3B7FC1]/20';

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
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => <div key={i} className="bg-[#1E2A3A] border border-[#253347] rounded-2xl h-36 animate-pulse" />)}
      </div>
    );
  }

  if (profileQuery.isError || !profileQuery.data) {
    return (
      <div className="bg-[#1E2A3A] border border-[#253347] rounded-2xl p-12 text-center">
        <span className="material-symbols-outlined text-4xl text-[#4A6080]">error</span>
        <p className="mt-3 font-semibold text-[#E2EAF4]">Failed to load profile</p>
        <p className="mt-1 text-sm text-[#8EA5C0]">{getApiErrorMessage(profileQuery.error)}</p>
      </div>
    );
  }

  const profile = profileQuery.data;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#E2EAF4] tracking-tight">Vendor Profile</h1>
          <p className="mt-1 text-sm text-[#8EA5C0]">Manage your business details.</p>
        </div>
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold border ${profile.isApproved ? 'bg-green-500/15 text-green-400 border-green-500/30' : 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30'}`}>
          {profile.isApproved ? 'APPROVED' : 'PENDING'}
        </span>
      </div>

      {!isEditing ? (
        <div className="bg-[#1E2A3A] border border-[#253347] rounded-2xl p-6 space-y-5">
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
          <button
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-[#253347] text-[#E2EAF4] hover:bg-[#2E3D50] transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">edit</span>
            Edit Profile
          </button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="bg-[#1E2A3A] border border-[#253347] rounded-2xl p-6 space-y-5">
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
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">{errors.root.message}</div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-[#3B7FC1] hover:bg-[#2B6FAF] text-white transition-all disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-[18px]">save</span>
              {updateMutation.isPending ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => {
                reset(initialValues);
                clearErrors('root');
                setIsEditing(false);
              }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-[#8EA5C0] hover:text-[#E2EAF4] hover:bg-[#253347] transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[#111827] border border-[#253347] p-3">
      <p className="text-xs text-[#4A6080]">{label}</p>
      <p className="mt-1 text-sm font-medium text-[#E2EAF4] break-all">{value}</p>
    </div>
  );
}

function FormField({ id, label, error, children }: { id: string; label: string; error?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-[#8EA5C0]" htmlFor={id}>{label}</label>
      {children}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
