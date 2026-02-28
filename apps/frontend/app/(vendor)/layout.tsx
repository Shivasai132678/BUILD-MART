'use client';

import axios from 'axios';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { getVendorProfile } from '@/lib/vendor-profile-api';
import { useUserStore } from '@/store/user.store';
import { Navbar } from '@/components/ui/Navbar';
import { Loader2 } from 'lucide-react';

const vendorNavLinks = [
  { href: '/vendor/dashboard', label: 'Dashboard' },
  { href: '/vendor/profile', label: 'Profile' },
  { href: '/vendor/rfq', label: 'Available RFQs' },
  { href: '/vendor/orders', label: 'My Orders' },
];

export default function VendorLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useUserStore((s) => s.user);
  const setUser = useUserStore((s) => s.setUser);
  const clearUser = useUserStore((s) => s.clearUser);
  const [isCheckingProfile, setIsCheckingProfile] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => { setHydrated(true); }, []);

  useEffect(() => {
    if (!hydrated) return;
    let isActive = true;
    const checkAccess = async () => {
      let currentUser = user;
      if (!currentUser) {
        try {
          const res = await api.get('/api/v1/auth/me');
          const data = res.data?.data ?? res.data;
          if (data?.role === 'VENDOR') { setUser(data); currentUser = data; }
          else { router.replace('/login'); if (isActive) setIsCheckingProfile(false); return; }
        } catch { router.replace('/login'); if (isActive) setIsCheckingProfile(false); return; }
      }
      if (currentUser?.role !== 'VENDOR') { router.replace('/login'); if (isActive) setIsCheckingProfile(false); return; }
      const isOnboardingRoute = pathname.startsWith('/vendor/onboarding');
      try {
        await getVendorProfile();
        if (isOnboardingRoute) router.replace('/vendor/dashboard');
      } catch (error) {
        if (!isActive) return;
        if (axios.isAxiosError(error) && error.response?.status === 404) {
          if (!isOnboardingRoute) router.replace('/vendor/onboarding');
          if (isActive) setIsCheckingProfile(false);
          return;
        }
        if (axios.isAxiosError(error) && error.response?.status === 401) {
          clearUser(); router.replace('/login');
          if (isActive) setIsCheckingProfile(false);
          return;
        }
      } finally { if (isActive) setIsCheckingProfile(false); }
    };
    void checkAccess();
    return () => { isActive = false; };
  }, [hydrated, clearUser, pathname, router, user, setUser]);

  if (!hydrated || !user || user.role !== 'VENDOR' || isCheckingProfile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-base">
        <div className="flex items-center gap-3 text-sm text-text-secondary">
          <Loader2 className="h-5 w-5 animate-spin text-accent" />
          {isCheckingProfile ? 'Checking vendor profile…' : 'Loading…'}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base">
      <Navbar links={vendorNavLinks} portalLabel="Vendor" portalColor="purple" />
      <main className="mx-auto w-full max-w-7xl px-6 py-8">{children}</main>
    </div>
  );
}
