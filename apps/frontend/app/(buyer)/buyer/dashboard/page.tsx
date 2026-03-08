'use client';

import { useQueries, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { fetchBuyerOrders, fetchBuyerRfqs } from '@/lib/buyer-api';
import { formatIST } from '@/lib/utils/date';
import { useUserStore } from '@/store/user.store';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function RfqStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; classes: string }> = {
    OPEN:   { label: 'Open',   classes: 'bg-blue-500/15 text-blue-400 border border-blue-500/30' },
    QUOTED: { label: 'Quoted', classes: 'bg-green-500/15 text-green-400 border border-green-500/30' },
    CLOSED: { label: 'Closed', classes: 'bg-[#7A7067]/20 text-[#A89F91] border border-[#3A3027]' },
    EXPIRED:{ label: 'Expired',classes: 'bg-red-500/10 text-red-400 border border-red-500/20' },
  };
  const { label, classes } = map[status] ?? { label: status, classes: 'bg-[#7A7067]/20 text-[#A89F91] border border-[#3A3027]' };
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${classes}`}>{label}</span>;
}

function StatCard({ icon, label, value, sublabel, color }: { icon: string; label: string; value: string | number; sublabel?: string; color: string }) {
  return (
    <div className="bg-[#1A1714] border border-[#2A2520] rounded-2xl p-5 flex items-start gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        <span className="material-symbols-outlined text-[22px]">{icon}</span>
      </div>
      <div>
        <div className="text-2xl font-bold text-[#F5F0E8]">{value}</div>
        <div className="text-sm text-[#A89F91] mt-0.5">{label}</div>
        {sublabel && <div className="text-xs text-[#7A7067] mt-0.5">{sublabel}</div>}
      </div>
    </div>
  );
}

export default function BuyerDashboardPage() {
  const user = useUserStore((s) => s.user);

  const recentRfqsQuery = useQuery({
    queryKey: ['buyer-rfqs', 'recent'],
    queryFn: () => fetchBuyerRfqs(5, 0),
  });

  const quotedRfqsQuery = useQuery({
    queryKey: ['buyer-rfqs', 'quoted-count'],
    queryFn: () => fetchBuyerRfqs(1, 0, 'QUOTED'),
  });

  const orderCountQueries = useQueries({
    queries: [
      { queryKey: ['buyer-orders', 'confirmed-count'], queryFn: () => fetchBuyerOrders(1, 0, 'CONFIRMED') },
      { queryKey: ['buyer-orders', 'ofd-count'], queryFn: () => fetchBuyerOrders(1, 0, 'OUT_FOR_DELIVERY') },
      { queryKey: ['buyer-orders', 'delivered-count'], queryFn: () => fetchBuyerOrders(1, 0, 'DELIVERED') },
    ],
  });

  const rfqTotal = recentRfqsQuery.data?.total ?? 0;
  const quotedRfqs = quotedRfqsQuery.data?.total ?? 0;
  const confirmedCount = orderCountQueries[0]?.data?.total ?? 0;
  const outForDeliveryCount = orderCountQueries[1]?.data?.total ?? 0;
  const deliveredCount = orderCountQueries[2]?.data?.total ?? 0;
  const activeOrders = confirmedCount + outForDeliveryCount;

  const isLoading = recentRfqsQuery.isLoading || quotedRfqsQuery.isLoading || orderCountQueries.some((q) => q.isLoading);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header row */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[#F5F0E8]">
            {getGreeting()}, {user?.name ?? 'there'} 👋
          </h1>
          <p className="text-[#A89F91] text-sm mt-1">Here&apos;s what&apos;s happening with your procurement</p>
        </div>
        <Link
          href="/buyer/rfq/new"
          className="inline-flex items-center gap-2 bg-[#D97706] hover:bg-[#B45309] text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          New RFQ
        </Link>
      </div>

      {/* Stat cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-[#1A1714] border border-[#2A2520] rounded-2xl p-5 animate-pulse h-28" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon="request_quote" label="Total RFQs" value={rfqTotal} color="bg-[#D97706]/15 text-[#D97706]" />
          <StatCard icon="mark_chat_read" label="Quotes Received" value={quotedRfqs} color="bg-green-500/15 text-green-400" />
          <StatCard icon="local_shipping" label="Active Orders" value={activeOrders} color="bg-purple-500/15 text-purple-400" />
          <StatCard icon="check_circle" label="Delivered" value={deliveredCount} color="bg-blue-500/15 text-blue-400" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent RFQs table */}
        <div className="lg:col-span-2 bg-[#1A1714] border border-[#2A2520] rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#2A2520]">
            <h2 className="font-semibold text-[#F5F0E8] flex items-center gap-2">
              <span className="material-symbols-outlined text-[#D97706] text-[20px]">request_quote</span>
              Recent RFQs
            </h2>
            <Link href="/buyer/rfq" className="text-xs text-[#D97706] hover:text-[#F59E0B] font-medium transition-colors flex items-center gap-1">
              View all <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
            </Link>
          </div>

          {recentRfqsQuery.isLoading ? (
            <div className="p-5 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-12 bg-[#211E19] rounded-xl animate-pulse" />
              ))}
            </div>
          ) : recentRfqsQuery.data && recentRfqsQuery.data.items.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#2A2520]">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-[#7A7067] uppercase tracking-wide">RFQ ID</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-[#7A7067] uppercase tracking-wide">Location</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-[#7A7067] uppercase tracking-wide">Items</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-[#7A7067] uppercase tracking-wide">Status</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-[#7A7067] uppercase tracking-wide">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentRfqsQuery.data.items.map((rfq) => (
                    <tr key={rfq.id} className="border-b border-[#2A2520] hover:bg-[#211E19] transition-colors">
                      <td className="px-5 py-3.5">
                        <Link href={`/buyer/rfq/${rfq.id}`} className="font-mono text-xs text-[#D97706] hover:text-[#F59E0B]">
                          #{rfq.id.slice(0, 8)}
                        </Link>
                      </td>
                      <td className="px-5 py-3.5 text-[#A89F91]">{rfq.city}</td>
                      <td className="px-5 py-3.5 text-[#A89F91]">{rfq.items.length} item{rfq.items.length !== 1 ? 's' : ''}</td>
                      <td className="px-5 py-3.5"><RfqStatusBadge status={rfq.status} /></td>
                      <td className="px-5 py-3.5 text-[#7A7067] text-xs">{formatIST(rfq.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 px-5 text-center">
              <span className="material-symbols-outlined text-[48px] text-[#3A3027] mb-3">request_quote</span>
              <p className="text-sm font-medium text-[#A89F91]">No RFQs yet</p>
              <p className="text-xs text-[#7A7067] mt-1 mb-4">Create your first RFQ to start receiving vendor quotes</p>
              <Link href="/buyer/rfq/new" className="inline-flex items-center gap-1.5 bg-[#D97706] text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-[#B45309] transition-colors">
                <span className="material-symbols-outlined text-[14px]">add</span>
                Create RFQ
              </Link>
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div className="space-y-4">
          <div className="bg-[#1A1714] border border-[#2A2520] rounded-2xl p-5">
            <h2 className="font-semibold text-[#F5F0E8] mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-[#D97706] text-[20px]">bolt</span>
              Quick Actions
            </h2>
            <div className="space-y-2">
              {[
                { href: '/buyer/catalog', icon: 'inventory_2', label: 'Browse Catalog', sub: 'Explore products', color: 'text-blue-400 bg-blue-500/15' },
                { href: '/buyer/rfq/new', icon: 'add_circle', label: 'Post RFQ', sub: 'Get vendor quotes', color: 'text-[#D97706] bg-[#D97706]/15' },
                { href: '/buyer/orders', icon: 'local_shipping', label: 'Track Orders', sub: 'View all orders', color: 'text-green-400 bg-green-500/15' },
              ].map((a) => (
                <Link key={a.href} href={a.href} className="flex items-center gap-3 p-3 rounded-xl hover:bg-[#211E19] transition-colors group">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${a.color}`}>
                    <span className="material-symbols-outlined text-[20px]">{a.icon}</span>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-[#F5F0E8] group-hover:text-[#D97706] transition-colors">{a.label}</div>
                    <div className="text-xs text-[#7A7067]">{a.sub}</div>
                  </div>
                  <span className="material-symbols-outlined text-[18px] text-[#3A3027] group-hover:text-[#D97706] ml-auto transition-colors">arrow_forward</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Order summary */}
          <div className="bg-[#1A1714] border border-[#2A2520] rounded-2xl p-5">
            <h2 className="font-semibold text-[#F5F0E8] mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-[#D97706] text-[20px]">package_2</span>
              Order Summary
            </h2>
            <div className="space-y-3">
              {[
                { label: 'Confirmed', value: confirmedCount, icon: 'check_circle', color: 'text-green-400' },
                { label: 'Out for Delivery', value: outForDeliveryCount, icon: 'local_shipping', color: 'text-[#D97706]' },
                { label: 'Delivered', value: deliveredCount, icon: 'package_2', color: 'text-blue-400' },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-[#A89F91]">
                    <span className={`material-symbols-outlined text-[18px] ${item.color}`}>{item.icon}</span>
                    {item.label}
                  </div>
                  <span className="text-sm font-semibold text-[#F5F0E8]">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
