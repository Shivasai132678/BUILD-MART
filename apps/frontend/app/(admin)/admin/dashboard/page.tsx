'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { getMetrics, type AdminMetrics } from '@/lib/admin-api';

function getMetricValue(key: string, metrics?: AdminMetrics): string | number {
  if (!metrics) return '—';
  switch (key) {
    case 'users': return metrics.totalUsers ?? '—';
    case 'vendors': return metrics.totalVendors ?? '—';
    case 'pendingVendors': return metrics.pendingVendors ?? '—';
    case 'rfqs': return metrics.totalRfqs ?? '—';
    case 'orders': return metrics.totalOrders ?? '—';
    case 'gmv': return metrics.gmv != null ? `₹${Number(metrics.gmv).toLocaleString('en-IN')}` : '—';
    default: return '—';
  }
}

export default function AdminDashboardPage() {
  const metricsQuery = useQuery({ queryKey: ['admin-metrics'], queryFn: getMetrics, retry: false });
  const metrics = metricsQuery.data;
  const isLoading = metricsQuery.isLoading;

  const statCards = [
    { key: 'gmv', icon: 'currency_rupee', label: 'Total GMV', color: 'bg-[#6764f2]/15 text-[#6764f2]' },
    { key: 'rfqs', icon: 'request_quote', label: 'Total RFQs', color: 'bg-blue-500/15 text-blue-400' },
    { key: 'orders', icon: 'package_2', label: 'Total Orders', color: 'bg-green-500/15 text-green-400' },
    { key: 'vendors', icon: 'store', label: 'Approved Vendors', color: 'bg-purple-500/15 text-purple-400' },
    { key: 'users', icon: 'group', label: 'Total Users', color: 'bg-[#6764f2]/10 text-[#8B89F8]' },
    { key: 'pendingVendors', icon: 'pending', label: 'Pending Vendors', color: 'bg-amber-500/15 text-amber-400' },
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[#F5F0E8]">Admin Dashboard</h1>
          <p className="text-[#8A9BC0] text-sm mt-1">Platform metrics and management overview</p>
        </div>
        <Link
          href="/admin/vendors"
          className="inline-flex items-center gap-2 bg-[#6764f2] hover:bg-[#5552d0] text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">verified_user</span>
          Vendor Approvals
        </Link>
      </div>

      {/* Error alert */}
      {metricsQuery.isError && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl px-5 py-4 flex items-center gap-3">
          <span className="material-symbols-outlined text-amber-400 text-[20px]">warning</span>
          <p className="text-sm text-[#F5F0E8]">Admin metrics endpoint returned an error. Some data may be unavailable.</p>
        </div>
      )}

      {/* Stat cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-[#12152A] border border-[#1E2238] rounded-2xl h-28 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {statCards.map((s) => (
            <div key={s.key} className="bg-[#12152A] border border-[#1E2238] rounded-2xl p-5 flex items-start gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${s.color}`}>
                <span className="material-symbols-outlined text-[22px]">{s.icon}</span>
              </div>
              <div>
                <div className="text-2xl font-bold text-[#F5F0E8]">{getMetricValue(s.key, metrics)}</div>
                <div className="text-sm text-[#8A9BC0] mt-0.5">{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quick actions */}
      <div className="bg-[#12152A] border border-[#1E2238] rounded-2xl p-5">
        <h2 className="font-semibold text-[#F5F0E8] mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-[#6764f2] text-[20px]">bolt</span>
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { href: '/admin/vendors', icon: 'verified_user', label: 'Review Vendor Approvals', sub: 'Approve or reject pending vendors', color: 'text-[#6764f2] bg-[#6764f2]/15' },
            { href: '/admin/dashboard', icon: 'refresh', label: 'Refresh Metrics', sub: 'Reload platform statistics', color: 'text-blue-400 bg-blue-500/15', onClick: () => metricsQuery.refetch() },
          ].map((a) => (
            a.onClick ? (
              <button
                key={a.label}
                onClick={a.onClick}
                className="bg-[#1E2238] hover:border-[#6764f2]/30 border border-[#1E2238] rounded-xl p-4 flex items-center gap-3 group transition-colors text-left w-full"
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${a.color}`}>
                  <span className="material-symbols-outlined text-[20px]">{a.icon}</span>
                </div>
                <div>
                  <div className="text-sm font-medium text-[#F5F0E8] group-hover:text-[#8B89F8] transition-colors">{a.label}</div>
                  <div className="text-xs text-[#4A5A80]">{a.sub}</div>
                </div>
              </button>
            ) : (
              <Link
                key={a.href}
                href={a.href}
                className="bg-[#1E2238] hover:border-[#6764f2]/30 border border-[#1E2238] rounded-xl p-4 flex items-center gap-3 group transition-colors"
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${a.color}`}>
                  <span className="material-symbols-outlined text-[20px]">{a.icon}</span>
                </div>
                <div>
                  <div className="text-sm font-medium text-[#F5F0E8] group-hover:text-[#8B89F8] transition-colors">{a.label}</div>
                  <div className="text-xs text-[#4A5A80]">{a.sub}</div>
                </div>
                <span className="material-symbols-outlined text-[16px] text-[#1E2238] group-hover:text-[#6764f2] ml-auto transition-colors">arrow_forward</span>
              </Link>
            )
          ))}
        </div>
      </div>
    </div>
  );
}
