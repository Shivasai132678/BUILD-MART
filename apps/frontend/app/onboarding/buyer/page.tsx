'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { toast } from 'sonner';
import { api, getApiErrorMessage } from '@/lib/api';
import { useUserStore } from '@/store/user.store';

const schema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters'),
  companyName: z.string().trim().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function BuyerOnboardingPage() {
  const router = useRouter();
  const user = useUserStore((s) => s.user);
  const setUser = useUserStore((s) => s.setUser);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await api.post('/api/v1/onboarding/buyer-profile', {
        name: values.name,
        ...(values.companyName ? { companyName: values.companyName } : {}),
      });
    } catch (error) {
      toast.error(getApiErrorMessage(error));
      return;
    }
    if (user) {
      setUser({ ...user, name: values.name });
    }
    toast.success('Profile set up! Welcome to BuildMart.');
    router.replace('/buyer/dashboard');
  });

  return (
    <div className="w-full max-w-md">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#D97706]/15 mb-4">
          <span className="material-symbols-outlined text-[#D97706] text-[24px]">corporate_fare</span>
        </div>
        <h1 className="text-xl font-bold text-text-primary">Set up your buyer profile</h1>
        <p className="text-sm text-[#A89F91] mt-2">Tell us a bit about yourself to get started.</p>
      </div>

      <div className="bg-surface border border-[#2A2520] rounded-2xl p-6">
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="buyer-name" className="block text-sm font-medium text-[#C8BFB5] mb-1.5">
              Your name <span className="text-red-400">*</span>
            </label>
            <input
              id="buyer-name"
              type="text"
              placeholder="e.g. Ravi Kumar"
              autoFocus
              className="w-full h-11 rounded-xl border border-[#3A3027] bg-elevated px-4 text-sm text-text-primary placeholder:text-[#4A4037] outline-none focus:border-[#D97706] focus:ring-2 focus:ring-[#D97706]/20 transition-all"
              {...register('name')}
            />
            {errors.name && (
              <p className="text-xs text-red-400 mt-1">{errors.name.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="companyName" className="block text-sm font-medium text-[#C8BFB5] mb-1.5">
              Company name{' '}
              <span className="text-[#7A7067] font-normal">(optional)</span>
            </label>
            <input
              id="companyName"
              type="text"
              placeholder="e.g. Ravi Constructions Pvt Ltd"
              className="w-full h-11 rounded-xl border border-[#3A3027] bg-elevated px-4 text-sm text-text-primary placeholder:text-[#4A4037] outline-none focus:border-[#D97706] focus:ring-2 focus:ring-[#D97706]/20 transition-all"
              {...register('companyName')}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-12 rounded-xl bg-[#D97706] hover:bg-[#B45309] text-white font-semibold text-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                Setting up…
              </>
            ) : (
              'Continue to Dashboard'
            )}
          </button>
        </form>
      </div>

      <p className="text-center text-xs text-[#7A7067] mt-4">
        Changed your mind?{' '}
        <Link href="/onboarding" className="text-[#A89F91] hover:text-text-primary transition-colors">
          Go back
        </Link>
      </p>
    </div>
  );
}
