'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { toast } from 'sonner';
import { api, getApiErrorMessage } from '@/lib/api';
import { onboardVendor } from '@/lib/vendor-profile-api';
import { useUserStore } from '@/store/user.store';
import { getCategories, getProducts } from '@/lib/catalog-api';
import { useQuery } from '@tanstack/react-query';

const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

const schema = z.object({
  businessName: z.string().trim().min(2, 'Business name is required'),
  gstNumber: z
    .string()
    .trim()
    .toUpperCase()
    .regex(gstRegex, 'Enter a valid 15-character GST number'),
  city: z.string().trim().min(2, 'City is required'),
  serviceableAreas: z.string().trim().min(1, 'Enter at least one serviceable area'),
  productIds: z.array(z.string()).min(1, 'Select at least one product'),
});

type FormValues = z.infer<typeof schema>;

type Step = 'business' | 'products' | 'review';

export default function VendorOnboardingPage() {
  const router = useRouter();
  const setUser = useUserStore((s) => s.setUser);
  const [step, setStep] = useState<Step>('business');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      businessName: '',
      gstNumber: '',
      city: 'Hyderabad',
      serviceableAreas: '',
      productIds: [],
    },
  });

  const categoriesQuery = useQuery({
    queryKey: ['categories'],
    queryFn: () => getCategories(),
  });

  const productsQuery = useQuery({
    queryKey: ['products', selectedCategory],
    queryFn: () => getProducts({ categoryId: selectedCategory || undefined, limit: 100 }),
    enabled: !!selectedCategory,
  });

  const productIds = watch('productIds');
  const businessName = watch('businessName');
  const gstNumber = watch('gstNumber');
  const city = watch('city');
  const serviceableAreas = watch('serviceableAreas');

  const toggleProduct = (productId: string) => {
    const current = productIds;
    if (current.includes(productId)) {
      setValue('productIds', current.filter((id) => id !== productId));
    } else {
      setValue('productIds', [...current, productId]);
    }
  };

  const onSubmit = handleSubmit(async (values) => {
    try {
      const areas = values.serviceableAreas
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      await onboardVendor({
        businessName: values.businessName,
        gstNumber: values.gstNumber,
        city: values.city,
        serviceableAreas: areas,
        productIds: values.productIds,
      });

      const statusRes = await api.get('/api/v1/onboarding/status');
      const statusData = statusRes.data?.data ?? statusRes.data;
      if (statusData) {
        setUser((prev) => ({ ...(prev ?? {}), ...statusData }));
      }

      toast.success("Application submitted! You'll be notified once approved.");
      router.replace('/vendor/dashboard');
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  });

  const inputCls =
    'w-full h-11 rounded-xl border border-[#1E2A3A] bg-[#0D1117] px-4 text-sm text-text-primary placeholder:text-[#4A6080] outline-none focus:border-blue focus:ring-2 focus:ring-blue/20 transition-all';

  const canProceedToProducts = businessName && gstNumber && city && serviceableAreas;
  const canSubmit = productIds.length > 0;

  return (
    <div className="w-full max-w-2xl">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-blue/15 mb-4">
          <span className="material-symbols-outlined text-blue text-[24px]">storefront</span>
        </div>
        <h1 className="text-xl font-bold text-text-primary">Register your business</h1>
        <p className="text-sm text-[#8EA5C0] mt-2">
          {step === 'business' && 'Enter your business details'}
          {step === 'products' && 'Select the products you sell'}
          {step === 'review' && 'Review and submit your application'}
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {(['business', 'products', 'review'] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step === s
                  ? 'bg-blue text-white'
                  : (['business', 'products', 'review'] as Step[]).indexOf(s) < (['business', 'products', 'review'] as Step[]).indexOf(step)
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-[#1E2A3A] text-[#4A6080]'
              }`}
            >
              {(['business', 'products', 'review'] as Step[]).indexOf(s) < (['business', 'products', 'review'] as Step[]).indexOf(step) ? (
                <span className="material-symbols-outlined text-[16px]">check</span>
              ) : (
                i + 1
              )}
            </div>
            {i < 2 && <div className="w-8 h-px bg-[#1E2A3A] mx-2" />}
          </div>
        ))}
      </div>

      <div className="bg-[#111827] border border-[#1E2A3A] rounded-2xl p-6">
        {step === 'business' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#8EA5C0] mb-1.5">
                Business name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Sharma Building Supplies"
                autoFocus
                className={inputCls}
                {...register('businessName')}
              />
              {errors.businessName && (
                <p className="text-xs text-red-400 mt-1">{errors.businessName.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-[#8EA5C0] mb-1.5">
                GST number <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. 27AAPFU0939F1ZV"
                maxLength={15}
                className={`${inputCls} font-mono uppercase`}
                {...register('gstNumber')}
              />
              {errors.gstNumber && (
                <p className="text-xs text-red-400 mt-1">{errors.gstNumber.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-[#8EA5C0] mb-1.5">
                City <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Hyderabad"
                className={inputCls}
                {...register('city')}
              />
              {errors.city && (
                <p className="text-xs text-red-400 mt-1">{errors.city.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-[#8EA5C0] mb-1.5">
                Serviceable areas <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                placeholder="Hyderabad, Secunderabad, Warangal"
                className={inputCls}
                {...register('serviceableAreas')}
              />
              <p className="text-[10px] text-[#4A6080] mt-1">
                Comma-separated list of areas you can deliver to
              </p>
              {errors.serviceableAreas && (
                <p className="text-xs text-red-400 mt-1">{errors.serviceableAreas.message}</p>
              )}
            </div>

            <button
              type="button"
              onClick={() => setStep('products')}
              disabled={!canProceedToProducts}
              className="w-full h-12 rounded-xl bg-blue hover:bg-[#2563EB] text-white font-semibold text-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              Continue
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
          </div>
        )}

        {step === 'products' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#8EA5C0] mb-2">
                Select a category to browse products
              </label>
              {categoriesQuery.isLoading ? (
                <div className="flex items-center gap-2 text-[#4A6080]">
                  <span className="material-symbols-outlined animate-spin">progress_activity</span>
                  Loading categories...
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {categoriesQuery.data?.items.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                        selectedCategory === cat.id
                          ? 'bg-blue text-white'
                          : 'bg-[#1E2A3A] text-[#8EA5C0] hover:bg-[#2A3545]'
                      }`}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedCategory && (
              <div>
                <label className="block text-sm font-medium text-[#8EA5C0] mb-2">
                  Select products ({productIds.length} selected)
                </label>
                {productsQuery.isLoading ? (
                  <div className="flex items-center gap-2 text-[#4A6080]">
                    <span className="material-symbols-outlined animate-spin">progress_activity</span>
                    Loading products...
                  </div>
                ) : productsQuery.data?.items.length === 0 ? (
                  <p className="text-sm text-[#4A6080]">No products found in this category</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                    {productsQuery.data?.items.map((product) => (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => toggleProduct(product.id)}
                        className={`p-3 rounded-xl text-left text-sm transition-colors ${
                          productIds.includes(product.id)
                            ? 'bg-blue/20 border border-blue text-white'
                            : 'bg-[#1E2A3A] border border-transparent text-[#8EA5C0] hover:bg-[#2A3545]'
                        }`}
                      >
                        <div className="font-medium">{product.name}</div>
                        <div className="text-xs text-[#4A6080]">{product.unit}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {errors.productIds && (
              <p className="text-xs text-red-400">{errors.productIds.message}</p>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep('business')}
                className="flex-1 h-12 rounded-xl bg-[#1E2A3A] hover:bg-[#2A3545] text-[#8EA5C0] font-semibold text-sm transition-colors"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setStep('review')}
                disabled={!canSubmit}
                className="flex-1 h-12 rounded-xl bg-blue hover:bg-[#2563EB] text-white font-semibold text-sm transition-colors disabled:opacity-60"
              >
                Review
              </button>
            </div>
          </div>
        )}

        {step === 'review' && (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="bg-[#0D1117] rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-semibold text-white">Business Details</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="text-[#4A6080]">Business Name:</span>
                <span className="text-[#8EA5C0]">{businessName}</span>
                <span className="text-[#4A6080]">GST Number:</span>
                <span className="text-[#8EA5C0] font-mono">{gstNumber}</span>
                <span className="text-[#4A6080]">City:</span>
                <span className="text-[#8EA5C0]">{city}</span>
                <span className="text-[#4A6080]">Service Areas:</span>
                <span className="text-[#8EA5C0]">{serviceableAreas}</span>
              </div>
            </div>

            <div className="bg-[#0D1117] rounded-xl p-4">
              <h3 className="text-sm font-semibold text-white mb-2">
                Selected Products ({productIds.length})
              </h3>
              <p className="text-xs text-[#4A6080]">
                These products will determine which RFQs you receive
              </p>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep('products')}
                className="flex-1 h-12 rounded-xl bg-[#1E2A3A] hover:bg-[#2A3545] text-[#8EA5C0] font-semibold text-sm transition-colors"
              >
                Edit Products
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 h-12 rounded-xl bg-blue hover:bg-[#2563EB] text-white font-semibold text-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                    Submitting…
                  </>
                ) : (
                  'Submit for Review'
                )}
              </button>
            </div>
          </form>
        )}
      </div>

      <p className="text-center text-xs text-[#4A6080] mt-4">
        Changed your mind?{' '}
        <Link href="/onboarding" className="text-[#8EA5C0] hover:text-text-primary transition-colors">
          Go back
        </Link>
      </p>
    </div>
  );
}
