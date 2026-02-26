'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { api } from '@/lib/api';
import { useUserStore } from '@/store/user.store';

const otpSchema = z.object({
  otp: z
    .string()
    .length(6, 'OTP must be 6 digits')
    .regex(/^[0-9]{6}$/, 'OTP must contain only digits'),
});

type OtpFormValues = z.infer<typeof otpSchema>;

type LoginUser = {
  id: string;
  phone: string;
  role: string;
  name?: string;
};

type OtpStepProps = {
  phone: string;
  onBack: () => void;
};

function Spinner() {
  return (
    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
  );
}

function getApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message;

    if (Array.isArray(message)) {
      return message.join(', ');
    }

    if (typeof message === 'string') {
      return message;
    }
  }

  return 'Request failed. Please try again.';
}

function extractVerifiedUser(payload: unknown): LoginUser | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const root = payload as Record<string, unknown>;
  const directUser = root.user;
  if (directUser && typeof directUser === 'object') {
    return directUser as LoginUser;
  }

  const nestedData = root.data;
  if (nestedData && typeof nestedData === 'object') {
    const nestedUser = (nestedData as Record<string, unknown>).user;
    if (nestedUser && typeof nestedUser === 'object') {
      return nestedUser as LoginUser;
    }
  }

  return null;
}

function getRedirectPath(role: string): string {
  switch (role) {
    case 'ADMIN':
      return '/admin/dashboard';
    case 'VENDOR':
      return '/vendor/dashboard';
    case 'BUYER':
    default:
      return '/buyer/dashboard';
  }
}

export function OtpStep({ phone, onBack }: OtpStepProps) {
  const router = useRouter();
  const setUser = useUserStore((state) => state.setUser);
  const [secondsLeft, setSecondsLeft] = useState(30);
  const [isResending, setIsResending] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
    clearErrors,
  } = useForm<OtpFormValues>({
    resolver: zodResolver(otpSchema),
    defaultValues: {
      otp: '',
    },
  });

  useEffect(() => {
    setSecondsLeft(30);
  }, [phone]);

  useEffect(() => {
    if (secondsLeft <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setSecondsLeft((current) => (current > 0 ? current - 1 : 0));
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [secondsLeft]);

  const onSubmit = handleSubmit(async (values) => {
    clearErrors('root');
    setResendError(null);

    try {
      const response = await api.post('/api/v1/auth/verify-otp', {
        phone,
        otp: values.otp,
      });

      const user = extractVerifiedUser(response.data);
      if (!user) {
        throw new Error('Missing user in verify response');
      }

      setUser(user);
      router.replace(getRedirectPath(user.role));
    } catch (error) {
      setError('root', {
        type: 'server',
        message: getApiErrorMessage(error),
      });
    }
  });

  const handleResend = async () => {
    setResendError(null);
    setIsResending(true);

    try {
      await api.post('/api/v1/auth/send-otp', { phone });
      setSecondsLeft(30);
    } catch (error) {
      setResendError(getApiErrorMessage(error));
    } finally {
      setIsResending(false);
    }
  };

  const countdownLabel = `${Math.floor(secondsLeft / 60)
    .toString()
    .padStart(2, '0')}:${(secondsLeft % 60).toString().padStart(2, '0')}`;

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
        OTP sent to <span className="font-medium text-slate-900">{phone}</span>
      </div>

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div className="space-y-2">
          <label htmlFor="otp" className="block text-sm font-medium text-slate-700">
            6-digit OTP
          </label>
          <input
            id="otp"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="123456"
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-center text-lg tracking-[0.35em] text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
            {...register('otp')}
          />
          {errors.otp ? <p className="text-sm text-red-600">{errors.otp.message}</p> : null}
        </div>

        {errors.root?.message ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errors.root.message}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? <Spinner /> : null}
          {isSubmitting ? 'Verifying...' : 'Verify OTP'}
        </button>
      </form>

      <div className="space-y-3 border-t border-slate-200 pt-4">
        <button
          type="button"
          onClick={onBack}
          className="text-sm font-medium text-slate-700 underline-offset-4 hover:text-slate-900 hover:underline"
        >
          Change phone number
        </button>

        {secondsLeft > 0 ? (
          <p className="text-sm text-slate-600">Resend OTP in {countdownLabel}</p>
        ) : (
          <button
            type="button"
            onClick={handleResend}
            disabled={isResending}
            className="flex items-center gap-2 text-sm font-medium text-slate-900 underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isResending ? <Spinner /> : null}
            {isResending ? 'Resending...' : 'Resend OTP'}
          </button>
        )}

        {resendError ? <p className="text-sm text-red-600">{resendError}</p> : null}
      </div>
    </div>
  );
}
