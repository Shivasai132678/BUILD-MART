'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { toast } from 'sonner';
import { api, getApiErrorMessage } from '@/lib/api';

const phoneSchema = z.object({
  phone: z.string().regex(/^\+91[0-9]{10}$/, 'Enter a valid Indian phone number (e.g. +919876543210)'),
});

type PhoneFormValues = z.infer<typeof phoneSchema>;

type PhoneStepProps = {
  initialPhone?: string;
  onSuccess: (phone: string) => void;
};

export function PhoneStep({ initialPhone, onSuccess }: PhoneStepProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PhoneFormValues>({
    resolver: zodResolver(phoneSchema),
    defaultValues: { phone: initialPhone ?? '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await api.post('/api/v1/auth/send-otp', { phone: values.phone });
      toast.success('OTP sent successfully!');
      onSuccess(values.phone);
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <div className="space-y-2">
        <label htmlFor="phone" className="block text-sm font-medium text-[#C8BFB5]">
          Phone Number
        </label>
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-[#7A7067]">
            <span className="material-symbols-outlined text-[20px]">phone</span>
          </div>
          <input
            id="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="+919876543210"
            className="w-full h-12 rounded-xl border border-[#3A3027] bg-[#211E19] pl-11 pr-4 text-sm text-[#F5F0E8] placeholder:text-[#5A5047] outline-none transition-all duration-200 focus:border-[#D97706] focus:ring-2 focus:ring-[#D97706]/20"
            {...register('phone')}
          />
        </div>
        {errors.phone && (
          <p className="text-xs text-red-400 font-medium flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">error</span>
            {errors.phone.message}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full h-12 rounded-xl bg-[#D97706] hover:bg-[#B45309] disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors duration-200 flex items-center justify-center gap-2"
      >
        {isSubmitting ? (
          <>
            <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
            Sending OTP…
          </>
        ) : (
          <>
            <span className="material-symbols-outlined text-[18px]">send</span>
            Get OTP
          </>
        )}
      </button>

      <p className="text-center text-xs text-[#7A7067]">
        By continuing, you agree to BuildMart&apos;s{' '}
        <a href="/terms" className="underline hover:text-[#F5F0E8] transition-colors">Terms of Service</a>{' '}
        and{' '}
        <a href="/privacy" className="underline hover:text-[#F5F0E8] transition-colors">Privacy Policy</a>
      </p>
    </form>
  );
}
