'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { toast } from 'sonner';
import { api, getApiErrorMessage } from '@/lib/api';
import { useUserStore } from '@/store/user.store';
import { Button } from '@/components/ui/Button';
import { ArrowLeft, Loader2 } from 'lucide-react';

const otpSchema = z.object({
  otp: z.string().length(6, 'OTP must be 6 digits').regex(/^[0-9]{6}$/, 'OTP must contain only digits'),
});

type OtpFormValues = z.infer<typeof otpSchema>;

type LoginUser = { id: string; phone: string; role: string; name?: string };

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

function getRedirectPath(role: string): string {
  switch (role) {
    case 'ADMIN': return '/admin/dashboard';
    case 'VENDOR': return '/vendor/dashboard';
    default: return '/buyer/dashboard';
  }
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
      const redirect = searchParams.get('redirect');
      router.replace(redirect ?? getRedirectPath(user.role));
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
      <div className="rounded-xl bg-accent/10 border border-accent/20 px-4 py-3 text-sm text-text-secondary">
        OTP sent to <span className="font-medium text-text-primary">{phone}</span>
      </div>

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <label htmlFor="otp" className="block text-sm font-medium text-text-primary">6-digit OTP</label>
          <input
            id="otp"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="000000"
            className="w-full h-11 rounded-xl border border-border bg-elevated px-4 text-center text-xl tracking-[0.4em] font-bold text-text-primary placeholder:text-text-tertiary outline-none transition-all duration-200 focus:border-accent focus:ring-2 focus:ring-accent/20"
            {...register('otp')}
          />
          {errors.otp && <p className="text-xs text-danger font-medium">{errors.otp.message}</p>}
        </div>

        <Button type="submit" loading={isSubmitting} className="w-full h-11 rounded-xl">
          {isSubmitting ? 'Verifying…' : 'Verify OTP'}
        </Button>
      </form>

      <div className="flex items-center justify-between border-t border-border-subtle pt-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Change number
        </button>

        {secondsLeft > 0 ? (
          <p className="text-sm text-text-tertiary">Resend in {countdown}</p>
        ) : (
          <button
            type="button"
            onClick={handleResend}
            disabled={isResending}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:text-accent-hover transition-colors disabled:opacity-50"
          >
            {isResending && <Loader2 className="h-3 w-3 animate-spin" />}
            {isResending ? 'Sending…' : 'Resend OTP'}
          </button>
        )}
      </div>
    </div>
  );
}
