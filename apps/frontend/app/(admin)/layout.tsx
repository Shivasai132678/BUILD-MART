'use client';

import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useUserStore } from '@/store/user.store';

const navItems = [
  { href: '/admin/dashboard', icon: 'dashboard', label: 'Dashboard' },
  { href: '/admin/vendors', icon: 'verified_user', label: 'Vendor Approvals' },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const user = useUserStore((s) => s.user);
  const setUser = useUserStore((s) => s.setUser);
  const clearUser = useUserStore((s) => s.clearUser);
  const [hydrated, setHydrated] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

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
          if (data?.role === 'ADMIN') setUser(data);
          else router.replace('/login');
        })
        .catch(() => router.replace('/login'));
      return;
    }
    if (user.role !== 'ADMIN') router.replace('/login');
  }, [hydrated, router, user, setUser]);

  if (!hydrated || !user || user.role !== 'ADMIN') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0C0F1A]">
        <span className="material-symbols-outlined text-[32px] text-[#6764f2] animate-spin">progress_activity</span>
      </div>
    );
  }

  const handleLogout = async () => {
    try { await api.post('/api/v1/auth/logout'); } catch (_) { /* ignore */ }
    clearUser();
    router.replace('/login');
  };

  return (
    <div className="flex min-h-screen bg-[#0C0F1A]">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 flex flex-col bg-[#12152A] border-r border-[#1E2238] transition-transform duration-300 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static lg:z-auto`}>
        {/* Brand */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-[#1E2238]">
          <div className="w-8 h-8 rounded-lg bg-[#6764f2] flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-white text-[16px]">admin_panel_settings</span>
          </div>
          <div>
            <span className="text-[#F5F0E8] font-bold text-sm leading-tight">Build<span className="text-[#6764f2]">Mart</span></span>
            <p className="text-[10px] text-[#6764f2] font-medium">Admin Portal</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-[#6764f2]/15 text-[#8B89F8] border border-[#6764f2]/20'
                    : 'text-[#8A9BC0] hover:bg-[#1E2238] hover:text-[#C8D3E8]'
                }`}
              >
                <span className={`material-symbols-outlined text-[20px] ${isActive ? 'text-[#6764f2]' : ''}`}>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User + logout */}
        <div className="px-3 py-4 border-t border-[#1E2238] space-y-2">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[#1E2238]">
            <div className="w-8 h-8 rounded-full bg-[#6764f2]/20 border border-[#6764f2]/30 flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-[#6764f2] text-[16px]">person</span>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-[#F5F0E8] truncate">{user.name ?? user.phone}</p>
              <p className="text-[10px] text-[#6764f2]">Administrator</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[#8A9BC0] hover:bg-[#1E2238] hover:text-red-400 transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">logout</span>
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile topbar */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-[#12152A] border-b border-[#1E2238] sticky top-0 z-20">
          <button onClick={() => setMobileOpen(true)} className="text-[#8A9BC0] hover:text-[#F5F0E8] transition-colors">
            <span className="material-symbols-outlined text-[24px]">menu</span>
          </button>
          <span className="text-[#F5F0E8] font-bold text-sm">Build<span className="text-[#6764f2]">Mart</span> Admin</span>
        </header>

        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
