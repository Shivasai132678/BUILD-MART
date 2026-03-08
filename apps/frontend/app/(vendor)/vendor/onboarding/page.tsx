'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { toast } from 'sonner';
import { Building2, MapPin, FileText } from 'lucide-react';
import { getApiErrorMessage } from '@/lib/api';
import { getVendorProfile, onboardVendor } from '@/lib/vendor-profile-api';
import { useUserStore } from '@/store/user.store';
import { Button } from '@/components/ui/Button';
import { MotionContainer } from '@/components/ui/Motion';
import { Loader2 } from 'lucide-react';

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

const inputClassName =
  'w-full h-10 rounded-xl border border-border bg-elevated px-4 text-sm text-text-primary placeholder:text-text-tertiary outline-none transition-all duration-200 focus:border-accent focus:ring-2 focus:ring-accent/20';

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
    onSuccess: async () => {
      try {
        const { api, unwrapApiData } = await import('@/lib/api');
        const meResponse = await api.get('/api/v1/auth/me');
        const me = unwrapApiData<{ id: string; phone: string; role: string }>(meResponse.data);
        useUserStore.getState().setUser(me);
      } catch {
        // Onboarding succeeded even if refetch fails
      }
      toast.success('Onboarding completed successfully!');
      router.push('/vendor/dashboard');
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

  // Bug #2 FIX: Include businessAddress, state, pincode, serviceRadius in payload
  const onSubmit = handleSubmit(async (values) => {
    clearErrors('root');

    const payload = {
      businessName: values.businessName.trim(),
      gstNumber: values.gstNumber.trim().toUpperCase(),
      businessAddress: values.businessAddress.trim(),
      city: values.city.trim(),
      state: values.state.trim(),
      pincode: values.pincode.trim(),
      serviceRadius: values.serviceRadius,
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
        <div className="flex items-center gap-3 text-sm text-text-secondary">
          <Loader2 className="h-5 w-5 animate-spin text-blue" />
          Checking vendor profile…
        </div>
      </div>
    );
  }

  if (profileQuery.isError && !isNotFoundError(profileQuery.error)) {
    return (
      <div className="rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
        {getApiErrorMessage(profileQuery.error, 'Failed to verify vendor profile status.')}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <MotionContainer>
        <div>
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">Complete Your Profile</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Fill out your business details to start receiving matching RFQs.
          </p>
        </div>
      </MotionContainer>

      <MotionContainer delay={0.1}>
        <form
          onSubmit={onSubmit}
          className="card p-6 space-y-6"
        >
          {/* Business info section */}
          <div className="space-y-1 mb-1">
            <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
              <Building2 className="h-4 w-4 text-blue" />
              Business Information
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <label className="block text-sm font-medium text-text-primary" htmlFor="businessName">
                Business Name
              </label>
              <input id="businessName" className={inputClassName} {...register('businessName')} />
              {errors.businessName && <p className="text-xs text-accent-danger">{errors.businessName.message}</p>}
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <label className="block text-sm font-medium text-text-primary" htmlFor="gstNumber">
                GST Number
              </label>
              <input
                id="gstNumber"
                className={`${inputClassName} uppercase`}
                placeholder="36AABCU9603R1ZX"
                {...register('gstNumber')}
              />
              {errors.gstNumber && <p className="text-xs text-accent-danger">{errors.gstNumber.message}</p>}
            </div>
          </div>

          {/* Location section */}
          <div className="border-t border-border pt-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-text-primary mb-4">
              <MapPin className="h-4 w-4 text-blue" />
              Location & Service Area
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <label className="block text-sm font-medium text-text-primary" htmlFor="businessAddress">
                Business Address
              </label>
              <input id="businessAddress" className={inputClassName} {...register('businessAddress')} />
              {errors.businessAddress && <p className="text-xs text-accent-danger">{errors.businessAddress.message}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-text-primary" htmlFor="city">
                City
              </label>
              <input id="city" className={inputClassName} {...register('city')} />
              {errors.city && <p className="text-xs text-accent-danger">{errors.city.message}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-text-primary" htmlFor="state">
                State
              </label>
              <input id="state" className={inputClassName} {...register('state')} />
              {errors.state && <p className="text-xs text-accent-danger">{errors.state.message}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-text-primary" htmlFor="pincode">
                Pincode
              </label>
              <input id="pincode" inputMode="numeric" className={inputClassName} {...register('pincode')} />
              {errors.pincode && <p className="text-xs text-accent-danger">{errors.pincode.message}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-text-primary" htmlFor="serviceRadius">
                Service Radius (km)
              </label>
              <input
                id="serviceRadius"
                type="number"
                min={1}
                className={inputClassName}
                {...register('serviceRadius', { valueAsNumber: true })}
              />
              {errors.serviceRadius && <p className="text-xs text-accent-danger">{errors.serviceRadius.message}</p>}
            </div>
          </div>

          {/* Documents section */}
          <div className="border-t border-border pt-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-text-primary mb-4">
              <FileText className="h-4 w-4 text-blue" />
              Documents (Optional)
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-text-primary" htmlFor="gstDocumentUrl">
                GST Document URL
              </label>
              <input id="gstDocumentUrl" className={inputClassName} placeholder="https://…" {...register('gstDocumentUrl')} />
              {errors.gstDocumentUrl && <p className="text-xs text-accent-danger">{errors.gstDocumentUrl.message}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-text-primary" htmlFor="businessLicenseUrl">
                Business License URL
              </label>
              <input id="businessLicenseUrl" className={inputClassName} placeholder="https://…" {...register('businessLicenseUrl')} />
              {errors.businessLicenseUrl && <p className="text-xs text-accent-danger">{errors.businessLicenseUrl.message}</p>}
            </div>
          </div>

          {errors.root && (
            <div className="rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
              {errors.root.message}
            </div>
          )}

          <div className="pt-2">
            <Button type="submit" loading={onboardingMutation.isPending} className="w-full sm:w-auto">
              {onboardingMutation.isPending ? 'Submitting…' : 'Complete Onboarding'}
            </Button>
          </div>
        </form>
      </MotionContainer>
    </div>
  );
}
