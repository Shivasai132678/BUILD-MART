'use client';

import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, refreshAuthToken } from '@/lib/api';
import { useUserStore } from '@/store/user.store';
import { Loader2 } from 'lucide-react';
import { NotificationBell } from '@/components/ui/NotificationBell';

const navItems = [
  { href: '/buyer/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { href: '/buyer/catalog', label: 'Catalog', icon: 'inventory_2' },
  { href: '/buyer/rfq/new', label: 'Create RFQ', icon: 'add_circle' },
  { href: '/buyer/rfq', label: 'My RFQs', icon: 'request_quote' },
  { href: '/buyer/orders', label: 'My Orders', icon: 'local_shipping' },
];

function isAllowedRole(role: string): boolean {
  return role === 'BUYER' || role === 'ADMIN';
}

export default function BuyerLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const user = useUserStore((s) => s.user);
  const setUser = useUserStore((s) => s.setUser);
  const clearUser = useUserStore((s) => s.clearUser);
  const [hydrated, setHydrated] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

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

  const handleActivateVendor = async () => {
    try {
      const data = await refreshAuthToken();
      if (data?.user) setUser(data.user);
      router.push('/vendor/dashboard');
    } catch {
      // ignore — user can retry via the dashboard banner
    }
  };

  const handleLogout = async () => {
    try { await api.post('/api/v1/auth/logout'); } catch { /* ignore */ }
    clearUser();
    router.replace('/login');
  };

  if (!hydrated || !user || !isAllowedRole(user.role)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-base">
        <div className="flex items-center gap-3 text-sm text-[#7A7067]">
          <Loader2 className="h-5 w-5 animate-spin text-[#D97706]" />
          Loading…
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-base">
      {/* Mobile sidebar overlay */}
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
      <aside className={`fixed top-0 left-0 z-30 h-full w-64 bg-surface border-r border-[#2A2520] flex flex-col transition-transform duration-300 lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:static lg:flex`}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-[#2A2520]">
          <div className="w-8 h-8 rounded-lg bg-[#D97706] flex items-center justify-center">
            <span className="material-symbols-outlined text-white text-[18px]">construction</span>
          </div>
          <div>
            <div className="text-[15px] font-bold text-text-primary">
              Build<span className="text-[#D97706]">Mart</span>
            </div>
            <div className="text-[10px] text-[#7A7067] uppercase tracking-widest font-medium">Buyer Portal</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/buyer/dashboard' && pathname.startsWith(item.href + '/'));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-[#D97706]/15 text-[#F59E0B] border border-[#D97706]/20'
                    : 'text-[#A89F91] hover:bg-elevated hover:text-text-primary'
                }`}
              >
                <span className={`material-symbols-outlined text-[20px] ${isActive ? 'text-[#F59E0B]' : 'text-[#7A7067]'}`}>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}

          {/* Vendor section */}
          <div className="pt-4 mt-4 border-t border-[#2A2520]">
            {!user.hasVendorProfile ? (
              <Link
                href="/onboarding/vendor"
                onClick={() => setSidebarOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 text-blue hover:bg-blue/10 hover:text-[#60A5FA] border border-transparent hover:border-blue/30"
              >
                <span className="material-symbols-outlined text-[20px] text-blue">storefront</span>
                Become a Vendor
              </Link>
            ) : !user.vendorApproved ? (
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[#7A7067] border border-[#2A2520]">
                <span className="material-symbols-outlined text-[20px] text-amber-500">schedule</span>
                Application Pending
              </div>
            ) : (
              <button
                onClick={() => { setSidebarOpen(false); void handleActivateVendor(); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-green-400 hover:bg-green-500/10 border border-transparent hover:border-green-500/30 transition-all duration-150"
              >
                <span className="material-symbols-outlined text-[20px]">storefront</span>
                Activate Vendor Access
              </button>
            )}
          </div>
        </nav>

        {/* User */}
        <div className="px-3 py-4 border-t border-[#2A2520]">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-elevated mb-2">
            <div className="w-8 h-8 rounded-lg bg-[#D97706]/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-[#D97706] text-[18px]">person</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-text-primary truncate">{user.displayName ?? user.name ?? 'Buyer'}</div>
              <div className="text-xs text-[#7A7067] truncate">{user.phone}</div>
            </div>
              <NotificationBell accentColor="#D97706" hoverBg="hover:bg-[#2A2520]" dropdownPosition="up" dropdownAlign="left" />
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-[#A89F91] hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">logout</span>
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="lg:hidden sticky top-0 z-10 flex items-center gap-3 px-4 py-3 bg-surface border-b border-[#2A2520]">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 rounded-lg text-[#A89F91] hover:bg-elevated hover:text-text-primary transition-colors"
          >
            <span className="material-symbols-outlined text-[22px]">menu</span>
          </button>
          <div className="flex-1 text-[15px] font-bold text-text-primary">
            Build<span className="text-[#D97706]">Mart</span>
          </div>
          <NotificationBell accentColor="#D97706" hoverBg="hover:bg-[#211E19]" dropdownPosition="down" />
        </header>

        <main className="flex-1 p-6 xl:p-8">{children}</main>
      </div>
    </div>
  );
}
