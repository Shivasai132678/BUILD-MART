'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import axios from 'axios';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { api } from '@/lib/api';

const phoneSchema = z.object({
  phone: z.string().regex(/^\+91[0-9]{10}$/, 'Enter a valid Indian phone number (e.g. +919876543210)'),
});

type PhoneFormValues = z.infer<typeof phoneSchema>;

type PhoneStepProps = {
  initialPhone?: string;
  onSuccess: (phone: string) => void;
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

  return 'Unable to send OTP. Please try again.';
}

export function PhoneStep({ initialPhone, onSuccess }: PhoneStepProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
    clearErrors,
  } = useForm<PhoneFormValues>({
    resolver: zodResolver(phoneSchema),
    defaultValues: {
      phone: initialPhone ?? '',
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    clearErrors('root');

    try {
      await api.post('/api/v1/auth/send-otp', { phone: values.phone });
      onSuccess(values.phone);
    } catch (error) {
      setError('root', {
        type: 'server',
        message: getApiErrorMessage(error),
      });
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="space-y-2">
        <label htmlFor="phone" className="block text-sm font-medium text-slate-700">
          Phone Number
        </label>
        <input
          id="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="+919876543210"
          className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
          {...register('phone')}
        />
        {errors.phone ? (
          <p className="text-sm text-red-600">{errors.phone.message}</p>
        ) : null}
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
        {isSubmitting ? 'Sending OTP...' : 'Send OTP'}
      </button>
    </form>
  );
}
