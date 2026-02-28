'use client';

import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useUserStore } from '@/store/user.store';
import { Navbar } from '@/components/ui/Navbar';
import { Loader2 } from 'lucide-react';

const navLinks = [
  { href: '/buyer/dashboard', label: 'Dashboard' },
  { href: '/buyer/catalog', label: 'Catalog' },
  { href: '/buyer/rfq/new', label: 'Create RFQ' },
  { href: '/buyer/orders', label: 'My Orders' },
];

function isAllowedRole(role: string): boolean {
  return role === 'BUYER' || role === 'ADMIN';
}

export default function BuyerLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const user = useUserStore((s) => s.user);
  const setUser = useUserStore((s) => s.setUser);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setHydrated(true), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!user) {
      api.get('/api/v1/auth/me')
        .then((res) => {
          const data = res.data?.data ?? res.data;
          if (data?.role && isAllowedRole(data.role)) setUser(data);
          else router.replace('/login');
        })
        .catch(() => router.replace('/login'));
      return;
    }
    if (!isAllowedRole(user.role)) router.replace('/login');
  }, [hydrated, router, user, setUser]);

  if (!hydrated || !user || !isAllowedRole(user.role)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-base">
        <div className="flex items-center gap-3 text-sm text-text-secondary">
          <Loader2 className="h-5 w-5 animate-spin text-accent" />
          Loading…
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base">
      <Navbar links={navLinks} portalLabel="Buyer" portalColor="orange" />
      <main className="mx-auto w-full max-w-7xl px-6 py-8">{children}</main>
    </div>
  );
}
