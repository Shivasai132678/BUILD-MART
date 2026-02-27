'use client';

import axios from 'axios';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { Spinner } from '@/components/ui/Spinner';
import { api } from '@/lib/api';
import { getVendorProfile } from '@/lib/vendor-profile-api';
import { useUserStore } from '@/store/user.store';

type VendorLayoutProps = {
  children: ReactNode;
};

const vendorNavLinks = [
  { href: '/vendor/dashboard', label: 'Dashboard' },
  { href: '/vendor/profile', label: 'Profile' },
  { href: '/vendor/rfq', label: 'Available RFQs' },
  { href: '/vendor/orders', label: 'My Orders' },
] as const;

export default function VendorLayout({ children }: VendorLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useUserStore((state) => state.user);
  const clearUser = useUserStore((state) => state.clearUser);
  const [isCheckingProfile, setIsCheckingProfile] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    let isActive = true;

    const checkAccess = async () => {
      if (!user || user.role !== 'VENDOR') {
        router.replace('/login');
        if (isActive) {
          setIsCheckingProfile(false);
        }
        return;
      }

      const isOnboardingRoute = pathname.startsWith('/vendor/onboarding');

      try {
        await getVendorProfile();
        if (isOnboardingRoute) {
          router.replace('/vendor/dashboard');
        }
      } catch (error) {
        if (!isActive) {
          return;
        }

        if (axios.isAxiosError(error) && error.response?.status === 404) {
          if (!isOnboardingRoute) {
            router.replace('/vendor/onboarding');
          }
          return;
        }

        if (axios.isAxiosError(error) && error.response?.status === 401) {
          clearUser();
          router.replace('/login');
          return;
        }
      } finally {
        if (isActive) {
          setIsCheckingProfile(false);
        }
      }
    };

    void checkAccess();

    return () => {
      isActive = false;
    };
  }, [clearUser, pathname, router, user]);

  if (!user || user.role !== 'VENDOR' || isCheckingProfile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
          <Spinner size="sm" />
          {isCheckingProfile ? 'Checking vendor profile...' : 'Redirecting to login...'}
        </div>
      </div>
    );
  }

  const handleLogout = async () => {
    setIsLoggingOut(true);

    try {
      await api.post('/api/v1/auth/logout');
    } catch {
      // Ignore and clear client state regardless.
    } finally {
      clearUser();
      router.replace('/login');
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-[0.16em] text-slate-500 uppercase">
              Vendor Portal
            </p>
            <p className="truncate text-sm text-slate-800">
              {user.name ?? user.phone}
            </p>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoggingOut ? <Spinner size="sm" /> : null}
            {isLoggingOut ? 'Logging out...' : 'Logout'}
          </button>
        </div>

        <nav className="border-t border-slate-100">
          <div className="mx-auto flex w-full max-w-6xl gap-2 overflow-x-auto px-4 py-2">
            {vendorNavLinks.map((link) => {
              const isActive = pathname.startsWith(link.href);

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    isActive
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
