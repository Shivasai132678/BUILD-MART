'use client';

import { useState } from 'react';
import { OtpStep } from './components/OtpStep';
import { PhoneStep } from './components/PhoneStep';

type LoginStep = 'phone' | 'otp';

export default function LoginPage() {
  const [step, setStep] = useState<LoginStep>('phone');
  const [phone, setPhone] = useState('');

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <p className="text-xs font-semibold tracking-[0.2em] text-slate-500 uppercase">
          BuildMart
        </p>
        <h1 className="text-2xl font-semibold text-slate-900">Login with OTP</h1>
        <p className="text-sm text-slate-600">
          {step === 'phone'
            ? 'Enter your phone number to receive an OTP.'
            : `Enter the 6-digit OTP sent to ${phone}.`}
        </p>
      </div>

      {step === 'phone' ? (
        <PhoneStep
          initialPhone={phone}
          onSuccess={(nextPhone) => {
            setPhone(nextPhone);
            setStep('otp');
          }}
        />
      ) : (
        <OtpStep
          phone={phone}
          onBack={() => {
            setStep('phone');
          }}
        />
      )}
    </div>
  );
}
