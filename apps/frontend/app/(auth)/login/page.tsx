'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { OtpStep } from './components/OtpStep';
import { PhoneStep } from './components/PhoneStep';

type LoginStep = 'phone' | 'otp';

export default function LoginPage() {
  const [step, setStep] = useState<LoginStep>('phone');
  const [phone, setPhone] = useState('');

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-3xl font-bold text-[#F5F0E8]">Welcome back</h2>
        <p className="text-[#A89F91]">
          {step === 'phone'
            ? 'Sign in to your BuildMart account'
            : `Enter the OTP sent to ${phone}`}
        </p>
      </div>

      <AnimatePresence mode="wait">
        {step === 'phone' ? (
          <motion.div
            key="phone"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] }}
          >
            <PhoneStep
              initialPhone={phone}
              onSuccess={(nextPhone) => {
                setPhone(nextPhone);
                setStep('otp');
              }}
            />
          </motion.div>
        ) : (
          <motion.div
            key="otp"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] }}
          >
            <OtpStep phone={phone} onBack={() => setStep('phone')} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
