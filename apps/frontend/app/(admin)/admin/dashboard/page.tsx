'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  getMetrics,
  getAllOrders,
  getAllVendors,
  getAllRfqs,
  getUsers,
  type AdminMetrics,
  type AdminOrder,
  type AdminVendorProfile,
  type AdminRfq,
  type AdminUser,
} from '@/lib/admin-api';
import { formatIST } from '@/lib/utils/date';

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

const ORDER_STATUS_STYLES: Record<string, string> = {
  CONFIRMED: 'bg-green-500/15 text-green-400 border border-green-500/30',
  OUT_FOR_DELIVERY: 'bg-blue-500/15 text-blue-400 border border-blue-500/30',
  DELIVERED: 'bg-green-600/15 text-green-300 border border-green-600/30',
  CANCELLED: 'bg-red-500/10 text-red-400 border border-red-500/20',
};

const RFQ_STATUS_STYLES: Record<string, string> = {
  OPEN: 'bg-blue-500/15 text-blue-400 border border-blue-500/30',
  QUOTED: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
  CLOSED: 'bg-[#4A6080]/20 text-[#8EA5C0] border border-[#1E2A3A]',
  EXPIRED: 'bg-red-500/10 text-red-400 border border-red-500/20',
};

const VENDOR_STATUS_STYLES: Record<string, string> = {
  APPROVED: 'bg-green-500/15 text-green-400 border border-green-500/30',
  PENDING: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
  REJECTED: 'bg-red-500/10 text-red-400 border border-red-500/20',
  SUSPENDED: 'bg-[#4A6080]/20 text-[#8EA5C0] border border-[#1E2A3A]',
};

function StatusBadge({ status, styleMap }: { status: string; styleMap: Record<string, string> }) {
  const cls = styleMap[status] ?? 'bg-[#4A6080]/20 text-[#8EA5C0]';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${cls}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

function SectionCard({
  title,
  icon,
  iconColor,
  children,
}: {
  title: string;
  icon: string;
  iconColor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-[#12152A] border border-[#1E2238] rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-[#1E2238] flex items-center gap-2">
        <span className={`material-symbols-outlined text-[20px] ${iconColor}`}>{icon}</span>
        <h2 className="font-semibold text-[#F5F0E8]">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="p-4 space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="grid animate-pulse gap-4" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
          {Array.from({ length: cols }).map((__, j) => (
            <div key={j} className="h-5 bg-[#1E2238] rounded-lg" />
          ))}
        </div>
      ))}
    </div>
  );
}

function EmptyRow({ message }: { message: string }) {
  return (
    <tr>
      <td colSpan={99} className="px-5 py-8 text-center text-sm text-[#4A5A80]">
        {message}
      </td>
    </tr>
  );
}

export default function AdminDashboardPage() {
  const metricsQuery = useQuery({ queryKey: ['admin-metrics'], queryFn: getMetrics, retry: false });
  const ordersQuery = useQuery({ queryKey: ['admin-orders-dash'], queryFn: () => getAllOrders(8, 0), retry: false });
  const vendorsQuery = useQuery({ queryKey: ['admin-vendors-dash'], queryFn: () => getAllVendors(8, 0), retry: false });
  const rfqsQuery = useQuery({ queryKey: ['admin-rfqs-dash'], queryFn: () => getAllRfqs(8, 0), retry: false });
  const usersQuery = useQuery({ queryKey: ['admin-users-dash'], queryFn: () => getUsers(8, 0), retry: false });

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

  const orders: AdminOrder[] = ordersQuery.data?.items ?? [];
  const vendors: AdminVendorProfile[] = vendorsQuery.data?.items ?? [];
  const rfqs: AdminRfq[] = rfqsQuery.data?.items ?? [];
  const users: AdminUser[] = usersQuery.data?.items ?? [];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[#F5F0E8]">Admin Dashboard</h1>
          <p className="text-[#8A9BC0] text-sm mt-1">Platform metrics and management overview</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              metricsQuery.refetch();
              ordersQuery.refetch();
              vendorsQuery.refetch();
              rfqsQuery.refetch();
              usersQuery.refetch();
            }}
            className="inline-flex items-center gap-2 bg-[#1E2238] hover:bg-[#252A45] text-[#8A9BC0] px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors border border-[#1E2238]"
          >
            <span className="material-symbols-outlined text-[18px]">refresh</span>
            Refresh
          </button>
          <Link
            href="/admin/vendors"
            className="inline-flex items-center gap-2 bg-[#6764f2] hover:bg-[#5552d0] text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">verified_user</span>
            Vendor Approvals
          </Link>
        </div>
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

      {/* Orders + Vendors row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Recent Orders */}
        <SectionCard title="Recent Orders" icon="package_2" iconColor="text-green-400">
          {ordersQuery.isLoading ? (
            <TableSkeleton rows={5} cols={4} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1E2238]">
                    <th className="px-5 py-3 text-left text-xs font-semibold text-[#4A5A80] uppercase tracking-wider">Order ID</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-[#4A5A80] uppercase tracking-wider">Status</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-[#4A5A80] uppercase tracking-wider">Amount</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-[#4A5A80] uppercase tracking-wider">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E2238]">
                  {orders.length === 0 ? (
                    <EmptyRow message="No orders yet" />
                  ) : orders.map((o) => (
                    <tr key={o.id} className="hover:bg-[#1E2238]/50 transition-colors">
                      <td className="px-5 py-3 font-mono text-xs text-[#8A9BC0]">{o.id.slice(-8).toUpperCase()}</td>
                      <td className="px-5 py-3"><StatusBadge status={o.status} styleMap={ORDER_STATUS_STYLES} /></td>
                      <td className="px-5 py-3 text-[#F5F0E8] font-medium">{(() => { const v = parseFloat(String(o.totalAmount)); return Number.isFinite(v) ? `₹${v.toLocaleString('en-IN')}` : '—'; })()}</td>
                      <td className="px-5 py-3 text-[#8A9BC0] text-xs">{formatIST(o.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

        {/* All Vendors */}
        <SectionCard title="Vendors" icon="store" iconColor="text-purple-400">
          {vendorsQuery.isLoading ? (
            <TableSkeleton rows={5} cols={4} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1E2238]">
                    <th className="px-5 py-3 text-left text-xs font-semibold text-[#4A5A80] uppercase tracking-wider">Business</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-[#4A5A80] uppercase tracking-wider">City</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-[#4A5A80] uppercase tracking-wider">Status</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-[#4A5A80] uppercase tracking-wider">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E2238]">
                  {vendors.length === 0 ? (
                    <EmptyRow message="No vendors yet" />
                  ) : vendors.map((v) => (
                    <tr key={v.id} className="hover:bg-[#1E2238]/50 transition-colors">
                      <td className="px-5 py-3">
                        <div className="text-[#F5F0E8] font-medium text-sm">{v.businessName}</div>
                        <div className="text-xs text-[#4A5A80]">{v.user?.phone ?? '—'}</div>
                      </td>
                      <td className="px-5 py-3 text-[#8A9BC0] text-xs">{v.city}</td>
                      <td className="px-5 py-3"><StatusBadge status={v.status} styleMap={VENDOR_STATUS_STYLES} /></td>
                      <td className="px-5 py-3 text-[#8A9BC0] text-xs">{formatIST(v.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {(vendorsQuery.data?.total ?? 0) > 8 && (
            <div className="px-5 py-3 border-t border-[#1E2238]">
              <Link href="/admin/vendors" className="text-xs text-[#6764f2] hover:underline">
                View all {vendorsQuery.data?.total} vendors →
              </Link>
            </div>
          )}
        </SectionCard>
      </div>

      {/* RFQs + Users row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Recent RFQs */}
        <SectionCard title="Recent RFQs" icon="request_quote" iconColor="text-blue-400">
          {rfqsQuery.isLoading ? (
            <TableSkeleton rows={5} cols={4} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1E2238]">
                    <th className="px-5 py-3 text-left text-xs font-semibold text-[#4A5A80] uppercase tracking-wider">RFQ ID</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-[#4A5A80] uppercase tracking-wider">Status</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-[#4A5A80] uppercase tracking-wider">City</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-[#4A5A80] uppercase tracking-wider">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E2238]">
                  {rfqs.length === 0 ? (
                    <EmptyRow message="No RFQs yet" />
                  ) : rfqs.map((r) => (
                    <tr key={r.id} className="hover:bg-[#1E2238]/50 transition-colors">
                      <td className="px-5 py-3 font-mono text-xs text-[#8A9BC0]">{r.id.slice(-8).toUpperCase()}</td>
                      <td className="px-5 py-3"><StatusBadge status={r.status} styleMap={RFQ_STATUS_STYLES} /></td>
                      <td className="px-5 py-3 text-[#8A9BC0] text-xs">{r.city ?? '—'}</td>
                      <td className="px-5 py-3 text-[#8A9BC0] text-xs">{formatIST(r.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

        {/* Users */}
        <SectionCard title="Users" icon="group" iconColor="text-[#8B89F8]">
          {usersQuery.isLoading ? (
            <TableSkeleton rows={5} cols={4} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1E2238]">
                    <th className="px-5 py-3 text-left text-xs font-semibold text-[#4A5A80] uppercase tracking-wider">Name</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-[#4A5A80] uppercase tracking-wider">Phone</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-[#4A5A80] uppercase tracking-wider">Role</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-[#4A5A80] uppercase tracking-wider">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E2238]">
                  {users.length === 0 ? (
                    <EmptyRow message="No users yet" />
                  ) : users.map((u) => (
                    <tr key={u.id} className="hover:bg-[#1E2238]/50 transition-colors">
                      <td className="px-5 py-3 text-[#F5F0E8] text-sm">{u.name ?? '—'}</td>
                      <td className="px-5 py-3 text-[#8A9BC0] text-xs font-mono">{u.phone}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                          u.role === 'ADMIN'
                            ? 'bg-[#6764f2]/15 text-[#8B89F8] border border-[#6764f2]/30'
                            : u.role === 'VENDOR'
                            ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30'
                            : 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-[#8A9BC0] text-xs">{u.createdAt ? formatIST(u.createdAt) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
