'use client';

import axios from 'axios';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { getVendorProfile } from '@/lib/vendor-profile-api';
import { useUserStore } from '@/store/user.store';
import { Loader2 } from 'lucide-react';
import { NotificationBell } from '@/components/ui/NotificationBell';
import { useRealtimeNotifications } from '@/hooks/useRealtimeNotifications';

const navItems = [
  { href: '/vendor/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { href: '/vendor/profile', label: 'My Profile', icon: 'badge' },
  { href: '/vendor/profile/products', label: 'My Products', icon: 'inventory_2' },
  { href: '/vendor/rfq', label: 'My RFQs', icon: 'request_quote' },
  { href: '/vendor/rfq/all', label: 'Browse All RFQs', icon: 'search' },
  { href: '/vendor/orders', label: 'My Orders', icon: 'package_2' },
  { href: '/vendor/analytics', label: 'Analytics', icon: 'bar_chart' },
];

function isAllowedRole(role: string): boolean {
  return role === 'VENDOR' || role === 'ADMIN' || role === 'PENDING';
}

export default function VendorLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useUserStore((s) => s.user);
  const setUser = useUserStore((s) => s.setUser);
  const clearUser = useUserStore((s) => s.clearUser);
  const [isCheckingProfile, setIsCheckingProfile] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useRealtimeNotifications();

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
          if (data?.role && isAllowedRole(data.role)) { setUser(data); currentUser = data; }
          else { router.replace('/login'); if (isActive) setIsCheckingProfile(false); return; }
        } catch { router.replace('/login'); if (isActive) setIsCheckingProfile(false); return; }
      }
      if (!currentUser?.role || !isAllowedRole(currentUser.role)) { router.replace('/login'); if (isActive) setIsCheckingProfile(false); return; }
      if (currentUser.role === 'ADMIN') { if (isActive) setIsCheckingProfile(false); return; }
      const isOnboardingRoute = pathname.startsWith('/vendor/onboarding');
      try {
        await getVendorProfile();
        // Profile exists — vendor may be PENDING approval, APPROVED, SUSPENDED, or REJECTED.
        // All of these are allowed to access the portal (UI enforces action restrictions).
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

  const handleLogout = async () => {
    try { await api.post('/api/v1/auth/logout'); } catch { /* ignore */ }
    clearUser();
    router.replace('/login');
  };

  if (!hydrated || !user || !isAllowedRole(user.role) || isCheckingProfile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-base">
        <div className="flex items-center gap-3 text-sm text-[#7A7067]">
          <Loader2 className="h-5 w-5 animate-spin text-blue" />
          {isCheckingProfile ? 'Checking vendor profile…' : 'Loading…'}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-base">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/60 lg:hidden"
          role="button"
          tabIndex={0}
          aria-label="Close sidebar"
          onClick={() => setSidebarOpen(false)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSidebarOpen(false); }}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed top-0 left-0 z-30 h-full w-64 bg-[#111827] border-r border-[#1E2A3A] flex flex-col transition-transform duration-300 lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:static lg:flex`}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-[#1E2A3A]">
          <div className="w-8 h-8 rounded-lg bg-blue flex items-center justify-center">
            <span className="material-symbols-outlined text-white text-[18px]">storefront</span>
          </div>
          <div>
            <div className="text-[15px] font-bold text-text-primary">
              Build<span className="text-blue">Mart</span>
            </div>
            <div className="text-[10px] text-[#4A6080] uppercase tracking-widest font-medium">Vendor Portal</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/vendor/dashboard' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-blue/15 text-[#60A5FA] border border-blue/20'
                    : 'text-[#8EA5C0] hover:bg-[#1E2A3A] hover:text-text-primary'
                }`}
              >
                <span className={`material-symbols-outlined text-[20px] ${isActive ? 'text-[#60A5FA]' : 'text-[#4A6080]'}`}>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="px-3 py-4 border-t border-[#1E2A3A]">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[#1E2A3A] mb-2">
            <div className="w-8 h-8 rounded-lg bg-blue/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-blue text-[18px]">store</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-text-primary truncate">{user.displayName ?? user.name ?? 'Vendor'}</div>
              <div className="text-xs text-[#4A6080] truncate">{user.phone}</div>
            </div>
            <NotificationBell accentColor="#3B7FC1" hoverBg="hover:bg-[#253545]" dropdownPosition="up" dropdownAlign="left" />
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-[#8EA5C0] hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">logout</span>
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="lg:hidden sticky top-0 z-10 flex items-center gap-3 px-4 py-3 bg-[#111827] border-b border-[#1E2A3A]">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 rounded-lg text-[#8EA5C0] hover:bg-[#1E2A3A] hover:text-text-primary transition-colors"
          >
            <span className="material-symbols-outlined text-[22px]">menu</span>
          </button>
          <div className="flex-1 text-[15px] font-bold text-text-primary">
            Build<span className="text-blue">Mart</span>
          </div>
          <NotificationBell accentColor="#3B7FC1" hoverBg="hover:bg-[#1E2A3A]" dropdownPosition="down" />
        </header>

        <main className="flex-1 p-6 xl:p-8">
          {/* Pending approval banner — shown for vendors whose profile hasn't been approved yet */}
          {user.role === 'PENDING' && user.hasVendorProfile && !user.vendorApproved && (
            <div className="mb-6 flex items-start gap-3 rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3.5">
              <span className="material-symbols-outlined text-yellow-400 text-[20px] mt-0.5 shrink-0">hourglass_top</span>
              <div>
                <p className="text-sm font-semibold text-yellow-300">Your account is pending approval</p>
                <p className="text-xs text-yellow-400/80 mt-0.5 leading-relaxed">
                  You can explore the dashboard, but you won&apos;t be able to submit quotes, respond to RFQs, or have your products visible to buyers until an admin approves your account.
                </p>
              </div>
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
