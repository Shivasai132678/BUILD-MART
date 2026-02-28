'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { toast } from 'sonner';
import { api, getApiErrorMessage } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Phone } from 'lucide-react';

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
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <label htmlFor="phone" className="block text-sm font-medium text-text-primary">
          Phone Number
        </label>
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-text-tertiary">
            <Phone className="h-4 w-4" />
          </div>
          <input
            id="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="+919876543210"
            className="w-full h-11 rounded-xl border border-border bg-elevated pl-10 pr-4 text-sm text-text-primary placeholder:text-text-tertiary outline-none transition-all duration-200 focus:border-accent focus:ring-2 focus:ring-accent/20"
            {...register('phone')}
          />
        </div>
        {errors.phone && (
          <p className="text-xs text-danger font-medium">{errors.phone.message}</p>
        )}
      </div>

      <Button type="submit" loading={isSubmitting} className="w-full h-11 rounded-xl">
        {isSubmitting ? 'Sending OTP…' : 'Get OTP'}
      </Button>
    </form>
  );
}
