'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { Spinner } from '@/components/ui/Spinner';
import { getApiErrorMessage } from '@/lib/api';
import { formatIST } from '@/lib/utils/date';
import {
  getVendorProfile,
  type UpdateVendorProfilePayload,
  updateVendorProfile,
} from '@/lib/vendor-profile-api';

const gstNumberRegex =
  /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

const optionalUrlSchema = z
  .union([
    z
      .string()
      .trim()
      .url('Enter a valid URL')
      .min(1, 'Enter a valid URL'),
    z.literal(''),
  ])
  .optional();

const profileSchema = z.object({
  businessName: z.string().trim().min(1, 'Business name is required'),
  gstNumber: z
    .string()
    .trim()
    .regex(gstNumberRegex, 'Enter a valid GST number'),
  city: z.string().trim().min(1, 'City is required'),
  serviceableAreas: z.string().trim().min(1, 'At least one serviceable area is required'),
  gstDocumentUrl: optionalUrlSchema,
  businessLicenseUrl: optionalUrlSchema,
});

type ProfileFormValues = z.infer<typeof profileSchema>;

function splitServiceableAreas(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(',')
        .map((value) => value.trim())
        .filter((value) => value.length > 0),
    ),
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
        : {
            businessName: '',
            gstNumber: '',
            city: '',
            serviceableAreas: '',
            gstDocumentUrl: '',
            businessLicenseUrl: '',
          },
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
    },
    onError: (error) => {
      setError('root', {
        type: 'server',
        message: getApiErrorMessage(error, 'Failed to update vendor profile.'),
      });
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    clearErrors('root');

    const payload: UpdateVendorProfilePayload = {
      businessName: values.businessName.trim(),
      gstNumber: values.gstNumber.trim().toUpperCase(),
      city: values.city.trim(),
      serviceableAreas: splitServiceableAreas(values.serviceableAreas),
      ...(values.gstDocumentUrl?.trim()
        ? { gstDocumentUrl: values.gstDocumentUrl.trim() }
        : { gstDocumentUrl: undefined }),
      ...(values.businessLicenseUrl?.trim()
        ? { businessLicenseUrl: values.businessLicenseUrl.trim() }
        : { businessLicenseUrl: undefined }),
    };

    await updateMutation.mutateAsync(payload);
  });

  if (profileQuery.isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-slate-700">
          <Spinner size="sm" />
          Loading vendor profile...
        </div>
      </div>
    );
  }

  if (profileQuery.isError || !profileQuery.data) {
    return (
      <ErrorMessage
        message={getApiErrorMessage(profileQuery.error, 'Failed to load vendor profile.')}
      />
    );
  }

  const profile = profileQuery.data;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Vendor Profile</h1>
          <p className="mt-1 text-sm text-slate-600">
            Manage your business details and approval status.
          </p>
        </div>

        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            profile.isApproved
              ? 'bg-emerald-100 text-emerald-800'
              : 'bg-amber-100 text-amber-800'
          }`}
        >
          {profile.isApproved ? 'Approved' : 'Pending approval'}
        </span>
      </div>

      {!isEditing ? (
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <InfoItem label="Business Name" value={profile.businessName} />
            <InfoItem label="GST Number" value={profile.gstNumber} />
            <InfoItem label="City" value={profile.city} />
            <InfoItem
              label="Serviceable Areas"
              value={profile.serviceableAreas.length > 0 ? profile.serviceableAreas.join(', ') : 'N/A'}
            />
            <InfoItem label="GST Document URL" value={profile.gstDocumentUrl ?? 'Not provided'} />
            <InfoItem
              label="Business License URL"
              value={profile.businessLicenseUrl ?? 'Not provided'}
            />
            <InfoItem label="Created" value={formatIST(profile.createdAt)} />
            <InfoItem label="Last Updated" value={formatIST(profile.updatedAt)} />
          </div>

          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-100"
          >
            Edit
          </button>
        </section>
      ) : (
        <form
          onSubmit={onSubmit}
          className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              id="businessName"
              label="Business Name"
              error={errors.businessName?.message}
            >
              <input
                id="businessName"
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
                {...register('businessName')}
              />
            </FormField>

            <FormField id="gstNumber" label="GST Number" error={errors.gstNumber?.message}>
              <input
                id="gstNumber"
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm uppercase outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
                {...register('gstNumber')}
              />
            </FormField>

            <FormField id="city" label="City" error={errors.city?.message}>
              <input
                id="city"
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
                {...register('city')}
              />
            </FormField>

            <FormField
              id="serviceableAreas"
              label="Serviceable Areas (comma separated)"
              error={errors.serviceableAreas?.message}
            >
              <input
                id="serviceableAreas"
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
                {...register('serviceableAreas')}
              />
            </FormField>

            <FormField
              id="gstDocumentUrl"
              label="GST Document URL (optional)"
              error={errors.gstDocumentUrl?.message}
            >
              <input
                id="gstDocumentUrl"
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
                {...register('gstDocumentUrl')}
              />
            </FormField>

            <FormField
              id="businessLicenseUrl"
              label="Business License URL (optional)"
              error={errors.businessLicenseUrl?.message}
            >
              <input
                id="businessLicenseUrl"
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
                {...register('businessLicenseUrl')}
              />
            </FormField>
          </div>

          <ErrorMessage message={errors.root?.message} />

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {updateMutation.isPending ? (
                <Spinner size="sm" className="border-white/30 border-t-white" />
              ) : null}
              {updateMutation.isPending ? 'Saving...' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => {
                reset(initialValues);
                clearErrors('root');
                setIsEditing(false);
              }}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-100"
            >
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
    <div className="rounded-xl border border-slate-200 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-medium break-all text-slate-900">{value}</p>
    </div>
  );
}

function FormField({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-700" htmlFor={id}>
        {label}
      </label>
      {children}
      <ErrorMessage message={error} />
    </div>
  );
}
