'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { getAvailableRfqs, getVendorOrders } from '@/lib/vendor-api';
import { getVendorProfile } from '@/lib/vendor-profile-api';
import { formatIST } from '@/lib/utils/date';
import { useUserStore } from '@/store/user.store';

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; classes: string }> = {
    OPEN:    { label: 'Open',    classes: 'bg-blue-500/15 text-blue-400 border border-blue-500/30' },
    QUOTED:  { label: 'Quoted',  classes: 'bg-green-500/15 text-green-400 border border-green-500/30' },
    CLOSED:  { label: 'Closed',  classes: 'bg-[#4A6080]/20 text-[#8EA5C0] border border-[#1E2A3A]' },
    EXPIRED: { label: 'Expired', classes: 'bg-red-500/10 text-red-400 border border-red-500/20' },
    CONFIRMED: { label: 'Confirmed', classes: 'bg-green-500/15 text-green-400 border border-green-500/30' },
    OUT_FOR_DELIVERY: { label: 'In Transit', classes: 'bg-[#3B7FC1]/15 text-[#60A5FA] border border-[#3B7FC1]/30' },
    DELIVERED: { label: 'Delivered', classes: 'bg-green-600/15 text-green-300 border border-green-600/30' },
    CANCELLED: { label: 'Cancelled', classes: 'bg-red-500/10 text-red-400 border border-red-500/20' },
  };
  const { label, classes } = map[status] ?? { label: status, classes: 'bg-[#4A6080]/20 text-[#8EA5C0]' };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${classes}`}>{label}</span>;
}

export default function VendorDashboardPage() {
  const user = useUserStore((s) => s.user);
  const profileQuery = useQuery({ queryKey: ['vendor-profile'], queryFn: getVendorProfile, retry: false });
  const rfqsQuery = useQuery({ queryKey: ['vendor-available-rfqs-dash'], queryFn: () => getAvailableRfqs(5, 0) });
  const ordersQuery = useQuery({ queryKey: ['vendor-orders-dash'], queryFn: () => getVendorOrders(1, 0) });

  const isApproved = profileQuery.data?.status === 'APPROVED';
  const rfqTotal = rfqsQuery.data?.total ?? 0;
  const orderTotal = ordersQuery.data?.total ?? 0;
  const recentRfqs = rfqsQuery.data?.items ?? [];
  const recentOrders = ordersQuery.data?.items ?? [];
  const isLoadingStats = rfqsQuery.isLoading || ordersQuery.isLoading || profileQuery.isLoading;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[#F5F0E8]">
            Welcome, {user?.name ?? 'Vendor'} 👋
          </h1>
          <p className="text-[#8EA5C0] text-sm mt-1">Manage your RFQs, quotes and orders</p>
        </div>
        <Link
          href="/vendor/rfq"
          className="inline-flex items-center gap-2 bg-[#3B7FC1] hover:bg-[#2B6FAF] text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">search</span>
          Browse RFQs
        </Link>
      </div>

      {/* Approval warning */}
      {!isApproved && !profileQuery.isLoading && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl px-5 py-4 flex items-start gap-3">
          <span className="material-symbols-outlined text-amber-400 text-[20px] mt-0.5">pending</span>
          <div>
            <p className="text-sm font-semibold text-[#F5F0E8]">Profile Pending Approval</p>
            <p className="text-sm text-[#8EA5C0] mt-0.5">Your vendor profile is under review. RFQs will match once your profile is approved.</p>
          </div>
        </div>
      )}

      {/* Stat cards */}
      {isLoadingStats ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-[#111827] border border-[#1E2A3A] rounded-2xl p-5 animate-pulse h-28" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { icon: 'request_quote', label: 'Available RFQs', value: rfqTotal, color: 'bg-[#3B7FC1]/15 text-[#3B7FC1]' },
            { icon: 'package_2', label: 'Total Orders', value: orderTotal, color: 'bg-green-500/15 text-green-400' },
            { icon: isApproved ? 'verified' : 'pending', label: 'Account Status', value: isApproved ? 'Approved' : 'Pending', color: isApproved ? 'bg-green-500/15 text-green-400' : 'bg-amber-500/15 text-amber-400' },
          ].map((s) => (
            <div key={s.label} className="bg-[#111827] border border-[#1E2A3A] rounded-2xl p-5 flex items-start gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${s.color}`}>
                <span className="material-symbols-outlined text-[22px]">{s.icon}</span>
              </div>
              <div>
                <div className="text-2xl font-bold text-[#F5F0E8]">{s.value}</div>
                <div className="text-sm text-[#8EA5C0] mt-0.5">{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent RFQs */}
        <div className="bg-[#111827] border border-[#1E2A3A] rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#1E2A3A]">
            <h2 className="font-semibold text-[#F5F0E8] flex items-center gap-2">
              <span className="material-symbols-outlined text-[#3B7FC1] text-[20px]">request_quote</span>
              Available RFQs
            </h2>
            <Link href="/vendor/rfq" className="text-xs text-[#3B7FC1] hover:text-[#60A5FA] font-medium flex items-center gap-1 transition-colors">
              View all <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
            </Link>
          </div>

          {rfqsQuery.isLoading ? (
            <div className="p-5 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-14 bg-[#1E2A3A] rounded-xl animate-pulse" />)}
            </div>
          ) : recentRfqs.length > 0 ? (
            <div className="divide-y divide-[#1E2A3A]">
              {recentRfqs.map((rfq) => (
                <Link key={rfq.id} href={`/vendor/rfq/${rfq.id}`} className="flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-[#1E2A3A] transition-colors group">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs text-[#3B7FC1]">#{rfq.id.slice(0, 8)}</span>
                      <StatusBadge status={rfq.status} />
                    </div>
                    <p className="text-xs text-[#4A6080]">{rfq.city} · {rfq.items?.length ?? 0} item{(rfq.items?.length ?? 0) !== 1 ? 's' : ''} · {formatIST(rfq.createdAt)}</p>
                  </div>
                  <span className="material-symbols-outlined text-[18px] text-[#1E2A3A] group-hover:text-[#3B7FC1] transition-colors">arrow_forward</span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 px-5 text-center">
              <span className="material-symbols-outlined text-[48px] text-[#1E2A3A] mb-3">request_quote</span>
              <p className="text-sm text-[#8EA5C0]">No available RFQs</p>
              <p className="text-xs text-[#4A6080] mt-1">New RFQs matching your profile will appear here</p>
            </div>
          )}
        </div>

        {/* Recent Orders */}
        <div className="bg-[#111827] border border-[#1E2A3A] rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#1E2A3A]">
            <h2 className="font-semibold text-[#F5F0E8] flex items-center gap-2">
              <span className="material-symbols-outlined text-[#3B7FC1] text-[20px]">package_2</span>
              Recent Orders
            </h2>
            <Link href="/vendor/orders" className="text-xs text-[#3B7FC1] hover:text-[#60A5FA] font-medium flex items-center gap-1 transition-colors">
              View all <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
            </Link>
          </div>

          {ordersQuery.isLoading ? (
            <div className="p-5 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-14 bg-[#1E2A3A] rounded-xl animate-pulse" />)}
            </div>
          ) : recentOrders.length > 0 ? (
            <div className="divide-y divide-[#1E2A3A]">
              {recentOrders.map((order) => (
                <div key={order.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs text-[#3B7FC1]">#{order.id.slice(0, 8)}</span>
                      <StatusBadge status={order.status} />
                    </div>
                    <p className="text-xs text-[#4A6080]">₹{order.totalAmount} · {formatIST(order.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 px-5 text-center">
              <span className="material-symbols-outlined text-[48px] text-[#1E2A3A] mb-3">package_2</span>
              <p className="text-sm text-[#8EA5C0]">No orders yet</p>
              <p className="text-xs text-[#4A6080] mt-1">Orders will appear after buyers accept your quotes</p>
            </div>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { href: '/vendor/rfq', icon: 'search', label: 'Browse RFQs', sub: 'Find matching requests', color: 'text-[#3B7FC1] bg-[#3B7FC1]/15' },
          { href: '/vendor/profile', icon: 'badge', label: 'My Profile', sub: 'Update business details', color: 'text-purple-400 bg-purple-500/15' },
          { href: '/vendor/orders', icon: 'package_2', label: 'My Orders', sub: 'Track fulfillment', color: 'text-green-400 bg-green-500/15' },
        ].map((a) => (
          <Link key={a.href} href={a.href} className="bg-[#111827] border border-[#1E2A3A] hover:border-[#3B7FC1]/30 rounded-2xl p-4 flex items-center gap-3 group transition-colors">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${a.color}`}>
              <span className="material-symbols-outlined text-[20px]">{a.icon}</span>
            </div>
            <div>
              <div className="text-sm font-medium text-[#F5F0E8] group-hover:text-[#60A5FA] transition-colors">{a.label}</div>
              <div className="text-xs text-[#4A6080]">{a.sub}</div>
            </div>
            <span className="material-symbols-outlined text-[16px] text-[#1E2A3A] group-hover:text-[#3B7FC1] ml-auto transition-colors">arrow_forward</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

