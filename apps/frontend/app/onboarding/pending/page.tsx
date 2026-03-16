'use client';

import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useUserStore } from '@/store/user.store';

export default function VendorPendingPage() {
  const router = useRouter();
  const clearUser = useUserStore((s) => s.clearUser);

  const handleSignOut = async () => {
    try { await api.post('/api/v1/auth/logout'); } catch { /* ignore */ }
    clearUser();
    router.replace('/login');
  };

  return (
    <div className="w-full max-w-lg text-center">
      {/* Logo */}
      <div className="inline-flex items-center gap-2 mb-8">
        <div className="w-10 h-10 rounded-xl bg-[#D97706] flex items-center justify-center">
          <span className="material-symbols-outlined text-white text-[20px]">construction</span>
        </div>
        <span className="text-2xl font-bold text-text-primary">
          Build<span className="text-[#D97706]">Mart</span>
        </span>
      </div>

      {/* Card */}
      <div className="bg-surface border border-[#2A2520] rounded-2xl p-8">
        <div className="w-16 h-16 rounded-full bg-[#D97706]/15 flex items-center justify-center mx-auto mb-4">
          <span className="material-symbols-outlined text-[#D97706] text-[32px]">hourglass_top</span>
        </div>

        <h1 className="text-xl font-bold text-text-primary mb-2">Application Under Review</h1>
        <p className="text-sm text-[#A89F91] leading-relaxed mb-6">
          Your vendor application has been submitted successfully. Our admin team will review
          your details and approve your account shortly. You&apos;ll receive a notification once
          you&apos;re approved.
        </p>

        <div className="bg-[#D97706]/10 border border-[#D97706]/30 rounded-xl p-4 mb-6 text-left">
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-[#D97706] text-[18px] mt-0.5 shrink-0">info</span>
            <p className="text-xs text-[#D97706]/90 leading-relaxed">
              Once approved, you&apos;ll be able to view RFQs, submit quotes, and manage orders on BuildMart.
            </p>
          </div>
        </div>

        <button
          onClick={() => void handleSignOut()}
          className="inline-flex items-center gap-2 text-sm text-[#7A7067] hover:text-text-primary transition-colors"
        >
          <span className="material-symbols-outlined text-[16px]">logout</span>
          Sign out
        </button>
      </div>
    </div>
  );
}
