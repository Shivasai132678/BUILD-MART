'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { Spinner } from '@/components/ui/Spinner';
import { getApiErrorMessage } from '@/lib/api';
import { getVendorProfile, onboardVendor } from '@/lib/vendor-profile-api';

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

const onboardingSchema = z.object({
  businessName: z.string().trim().min(1, 'Business name is required'),
  gstNumber: z
    .string()
    .trim()
    .regex(gstNumberRegex, 'Enter a valid GST number'),
  businessAddress: z.string().trim().min(1, 'Business address is required'),
  city: z.string().trim().min(1, 'City is required'),
  state: z.string().trim().min(1, 'State is required'),
  pincode: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Pincode must be a valid 6-digit code'),
  serviceRadius: z.number().min(1, 'Service radius must be at least 1 km'),
  gstDocumentUrl: optionalUrlSchema,
  businessLicenseUrl: optionalUrlSchema,
});

type OnboardingFormValues = z.infer<typeof onboardingSchema>;

function isNotFoundError(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 404;
}

export default function VendorOnboardingPage() {
  const router = useRouter();

  const profileQuery = useQuery({
    queryKey: ['vendor-profile', 'onboarding-check'],
    queryFn: getVendorProfile,
    retry: false,
  });

  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<OnboardingFormValues>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      businessName: '',
      gstNumber: '',
      businessAddress: '',
      city: 'Hyderabad',
      state: 'Telangana',
      pincode: '',
      serviceRadius: 15,
      gstDocumentUrl: '',
      businessLicenseUrl: '',
    },
  });

  const onboardingMutation = useMutation({
    mutationFn: onboardVendor,
    onSuccess: () => {
      router.replace('/vendor/dashboard');
    },
    onError: (error) => {
      setError('root', {
        type: 'server',
        message: getApiErrorMessage(error, 'Failed to submit onboarding details.'),
      });
    },
  });

  useEffect(() => {
    if (profileQuery.isSuccess) {
      router.replace('/vendor/dashboard');
    }
  }, [profileQuery.isSuccess, router]);

  const onSubmit = handleSubmit(async (values) => {
    clearErrors('root');

    const payload = {
      businessName: values.businessName.trim(),
      gstNumber: values.gstNumber.trim().toUpperCase(),
      city: values.city.trim(),
      serviceableAreas: [values.businessAddress.trim()],
      ...(values.gstDocumentUrl?.trim()
        ? { gstDocumentUrl: values.gstDocumentUrl.trim() }
        : {}),
      ...(values.businessLicenseUrl?.trim()
        ? { businessLicenseUrl: values.businessLicenseUrl.trim() }
        : {}),
    };

    await onboardingMutation.mutateAsync(payload);
  });

  if (profileQuery.isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-slate-700">
          <Spinner size="sm" />
          Checking vendor profile...
        </div>
      </div>
    );
  }

  if (profileQuery.isError && !isNotFoundError(profileQuery.error)) {
    return (
      <ErrorMessage
        message={getApiErrorMessage(
          profileQuery.error,
          'Failed to verify vendor profile status.',
        )}
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Vendor Onboarding</h1>
        <p className="mt-1 text-sm text-slate-600">
          Complete your vendor details to start receiving RFQs.
        </p>
      </div>

      <form
        onSubmit={onSubmit}
        className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <label className="block text-sm font-medium text-slate-700" htmlFor="businessName">
              Business Name
            </label>
            <input
              id="businessName"
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
              {...register('businessName')}
            />
            <ErrorMessage message={errors.businessName?.message} />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <label className="block text-sm font-medium text-slate-700" htmlFor="gstNumber">
              GST Number
            </label>
            <input
              id="gstNumber"
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm uppercase outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
              placeholder="36AABCU9603R1ZX"
              {...register('gstNumber')}
            />
            <ErrorMessage message={errors.gstNumber?.message} />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <label className="block text-sm font-medium text-slate-700" htmlFor="businessAddress">
              Business Address
            </label>
            <input
              id="businessAddress"
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
              {...register('businessAddress')}
            />
            <ErrorMessage message={errors.businessAddress?.message} />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700" htmlFor="city">
              City
            </label>
            <input
              id="city"
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
              {...register('city')}
            />
            <ErrorMessage message={errors.city?.message} />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700" htmlFor="state">
              State
            </label>
            <input
              id="state"
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
              {...register('state')}
            />
            <ErrorMessage message={errors.state?.message} />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700" htmlFor="pincode">
              Pincode
            </label>
            <input
              id="pincode"
              inputMode="numeric"
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
              {...register('pincode')}
            />
            <ErrorMessage message={errors.pincode?.message} />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700" htmlFor="serviceRadius">
              Service Radius (km)
            </label>
            <input
              id="serviceRadius"
              type="number"
              min={1}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
              {...register('serviceRadius', { valueAsNumber: true })}
            />
            <ErrorMessage message={errors.serviceRadius?.message} />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <label className="block text-sm font-medium text-slate-700" htmlFor="gstDocumentUrl">
              GST Document URL (optional)
            </label>
            <input
              id="gstDocumentUrl"
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
              placeholder="https://..."
              {...register('gstDocumentUrl')}
            />
            <ErrorMessage message={errors.gstDocumentUrl?.message} />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <label
              className="block text-sm font-medium text-slate-700"
              htmlFor="businessLicenseUrl"
            >
              Business License URL (optional)
            </label>
            <input
              id="businessLicenseUrl"
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
              placeholder="https://..."
              {...register('businessLicenseUrl')}
            />
            <ErrorMessage message={errors.businessLicenseUrl?.message} />
          </div>
        </div>

        <ErrorMessage message={errors.root?.message} />

        <button
          type="submit"
          disabled={onboardingMutation.isPending}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {onboardingMutation.isPending ? (
            <Spinner size="sm" className="border-white/30 border-t-white" />
          ) : null}
          {onboardingMutation.isPending ? 'Submitting...' : 'Submit Onboarding'}
        </button>
      </form>
    </div>
  );
}
