'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { toast } from 'sonner';
import { api, getApiErrorMessage } from '@/lib/api';
import { useUserStore } from '@/store/user.store';

const otpSchema = z.object({
  otp: z.string().length(6, 'OTP must be 6 digits').regex(/^[0-9]{6}$/, 'OTP must contain only digits'),
});

type OtpFormValues = z.infer<typeof otpSchema>;

type LoginUser = { id: string; phone: string; role: string; name?: string | null; displayName?: string | null; hasVendorProfile?: boolean; vendorApproved?: boolean };

type OtpStepProps = { phone: string; onBack: () => void };

function extractVerifiedUser(payload: unknown): LoginUser | null {
  if (!payload || typeof payload !== 'object') return null;
  const root = payload as Record<string, unknown>;
  const directUser = root.user;
  if (directUser && typeof directUser === 'object') return directUser as LoginUser;
  const nestedData = root.data;
  if (nestedData && typeof nestedData === 'object') {
    const nestedUser = (nestedData as Record<string, unknown>).user;
    if (nestedUser && typeof nestedUser === 'object') return nestedUser as LoginUser;
  }
  return null;
}

function getRedirectPath(user: LoginUser): string {
  switch (user.role) {
    case 'ADMIN': return '/admin/dashboard';
    case 'VENDOR': return '/vendor/dashboard';
    case 'PENDING':
      // A pending user who has already submitted a vendor profile goes to
      // the vendor dashboard in read-only preview mode.
      return user.hasVendorProfile ? '/vendor/dashboard' : '/onboarding';
    default: return '/buyer/dashboard';
  }
}

function resolvePostLoginTarget(user: LoginUser, redirectParam: string | null): string {
  const roleDefaultTarget =
    user.role === 'PENDING' && !user.hasVendorProfile
      ? '/onboarding'
      : getRedirectPath(user);

  if (!redirectParam) return roleDefaultTarget;

  const candidate = redirectParam.trim();
  if (!candidate) return roleDefaultTarget;

  // Allow only safe internal paths.
  if (!candidate.startsWith('/') || candidate.startsWith('//')) return roleDefaultTarget;
  // Never redirect back to login after successful auth.
  if (candidate === '/login' || candidate.startsWith('/login?')) return roleDefaultTarget;

  return candidate;
}

export function OtpStep({ phone, onBack }: OtpStepProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setUser = useUserStore((state) => state.setUser);
  const [secondsLeft, setSecondsLeft] = useState(30);
  const [isResending, setIsResending] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<OtpFormValues>({
    resolver: zodResolver(otpSchema),
    defaultValues: { otp: '' },
  });

  useEffect(() => { setSecondsLeft(30); }, [phone]);
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = window.setInterval(() => setSecondsLeft((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => window.clearInterval(timer);
  }, [secondsLeft]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      const response = await api.post('/api/v1/auth/verify-otp', { phone, otp: values.otp });
      const user = extractVerifiedUser(response.data);
      if (!user) throw new Error('Missing user in verify response');
      try { await api.get('/api/v1/auth/me'); } catch {
        toast.error('OTP verified, but session cookie was blocked. Enable third-party cookies and retry.');
        return;
      }
      setUser(user);
      toast.success('Logged in successfully!');
      const target = resolvePostLoginTarget(user, searchParams.get('redirect'));
      router.replace(target);
      router.refresh();

      // Production-safe fallback for cases where client-side navigation gets stuck.
      window.setTimeout(() => {
        if (window.location.pathname === '/login') {
          window.location.replace(target);
        }
      }, 250);
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  });

  const handleResend = async () => {
    setIsResending(true);
    try {
      await api.post('/api/v1/auth/send-otp', { phone });
      setSecondsLeft(30);
      toast.success('OTP resent!');
    } catch (error) { toast.error(getApiErrorMessage(error)); }
    finally { setIsResending(false); }
  };

  const countdown = `${String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:${String(secondsLeft % 60).padStart(2, '0')}`;

  return (
    <div className="space-y-5">
      <div className="rounded-xl bg-[#D97706]/10 border border-[#D97706]/20 px-4 py-3 text-sm text-[#A89F91] flex items-center gap-2">
        <span className="material-symbols-outlined text-[#D97706] text-[18px]">sms</span>
        OTP sent to <span className="font-semibold text-text-primary">{phone}</span>
      </div>

      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        <div className="space-y-2">
          <label htmlFor="otp" className="block text-sm font-medium text-[#C8BFB5]">Enter 6-digit OTP</label>
          <input
            id="otp"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="000000"
            className="w-full h-14 rounded-xl border border-[#3A3027] bg-elevated px-4 text-center text-2xl tracking-[0.5em] font-bold text-text-primary placeholder:text-[#4A4037] outline-none transition-all duration-200 focus:border-[#D97706] focus:ring-2 focus:ring-[#D97706]/20"
            {...register('otp')}
          />
          {errors.otp && (
            <p className="text-xs text-red-400 font-medium flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">error</span>
              {errors.otp.message}
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
              Verifying…
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-[18px]">verified</span>
              Verify OTP
            </>
          )}
        </button>
      </form>

      <div className="flex items-center justify-between border-t border-[#2A2520] pt-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[#A89F91] hover:text-text-primary transition-colors"
        >
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          Change number
        </button>

        {secondsLeft > 0 ? (
          <p className="text-sm text-[#7A7067]">Resend in {countdown}</p>
        ) : (
          <button
            type="button"
            onClick={handleResend}
            disabled={isResending}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[#D97706] hover:text-[#F59E0B] transition-colors disabled:opacity-50"
          >
            {isResending && <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>}
            {isResending ? 'Sending…' : 'Resend OTP'}
          </button>
        )}
      </div>
    </div>
  );
}
