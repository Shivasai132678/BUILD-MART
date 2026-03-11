'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { fetchBuyerOrders, type Order } from '@/lib/buyer-api';
import { formatIST } from '@/lib/utils/date';

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; classes: string }> = {
    CONFIRMED: { label: 'Confirmed', classes: 'bg-green-500/15 text-green-400 border border-green-500/30' },
    OUT_FOR_DELIVERY: { label: 'In Transit', classes: 'bg-[#D97706]/15 text-[#F59E0B] border border-[#D97706]/30' },
    DELIVERED: { label: 'Delivered', classes: 'bg-green-600/15 text-green-300 border border-green-600/30' },
    CANCELLED: { label: 'Cancelled', classes: 'bg-red-500/10 text-red-400 border border-red-500/20' },
  };
  const { label, classes } = map[status] ?? { label: status, classes: 'bg-[#3A3027]/50 text-[#A89F91]' };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${classes}`}>{label}</span>;
}

const STATUS_FILTERS: Array<{ label: string; value: Order['status'] | '' }> = [
  { label: 'All', value: '' },
  { label: 'Confirmed', value: 'CONFIRMED' },
  { label: 'In Transit', value: 'OUT_FOR_DELIVERY' },
  { label: 'Delivered', value: 'DELIVERED' },
  { label: 'Cancelled', value: 'CANCELLED' },
];

export default function BuyerOrdersPage() {
  const [statusFilter, setStatusFilter] = useState<Order['status'] | ''>('');
  const ordersQuery = useQuery({
    queryKey: ['buyer-orders', 'list', statusFilter],
    queryFn: () => fetchBuyerOrders(20, 0, statusFilter || undefined),
  });
  const items = ordersQuery.data?.items ?? [];
  const total = ordersQuery.data?.total ?? 0;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[#F5F0E8]">My Orders</h1>
          <p className="text-[#A89F91] text-sm mt-1">{total} order{total !== 1 ? 's' : ''} total</p>
        </div>
        <Link
          href="/buyer/rfq/new"
          className="inline-flex items-center gap-2 bg-[#D97706] hover:bg-[#B45309] text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">add_circle</span>
          Create RFQ
        </Link>
      </div>

      {/* Status filters */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setStatusFilter(f.value)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-all ${
              statusFilter === f.value
                ? 'bg-[#D97706]/15 text-[#F59E0B] border border-[#D97706]/20'
                : 'text-[#A89F91] hover:text-[#F5F0E8] hover:bg-[#2A2520] border border-[#2A2520]'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* List */}
      {ordersQuery.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-[#1A1714] border border-[#2A2520] rounded-2xl h-20 animate-pulse" />
          ))}
        </div>
      ) : ordersQuery.isError ? (
        <div className="bg-[#1A1714] border border-[#2A2520] rounded-2xl flex flex-col items-center justify-center py-20 text-center px-6">
          <span className="material-symbols-outlined text-[56px] text-[#2A2520] mb-4">error</span>
          <p className="text-base font-medium text-[#F5F0E8]">Failed to load orders</p>
          <p className="text-sm text-[#A89F91] mt-1">Something went wrong. Please try again later.</p>
        </div>
      ) : items.length === 0 ? (
        <div className="bg-[#1A1714] border border-[#2A2520] rounded-2xl flex flex-col items-center justify-center py-20 text-center px-6">
          <span className="material-symbols-outlined text-[56px] text-[#2A2520] mb-4">package_2</span>
          <p className="text-base font-medium text-[#F5F0E8]">No orders found</p>
          <p className="text-sm text-[#A89F91] mt-1">Accept a vendor quote to create your first order.</p>
          <Link href="/buyer/rfq/new" className="mt-4 inline-flex items-center gap-1.5 text-sm text-[#D97706] hover:text-[#F59E0B] font-medium transition-colors">
            <span className="material-symbols-outlined text-[16px]">add_circle</span>
            Create RFQ
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((order) => (
            <Link
              key={order.id}
              href={`/buyer/orders/${order.id}`}
              className="bg-[#1A1714] border border-[#2A2520] hover:border-[#D97706]/30 rounded-2xl flex items-center gap-4 px-5 py-4 group transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-[#D97706]/10 flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-[#D97706] text-[20px]">package_2</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="font-mono text-xs text-[#D97706]">{order.referenceCode || `#${order.id.slice(0, 10)}`}</span>
                  <StatusBadge status={order.status} />
                </div>
                <p className="text-sm text-[#A89F91]">{formatIST(order.createdAt)}</p>
              </div>
              <p className="text-lg font-bold text-[#F5F0E8]">₹{Number(order.totalAmount).toLocaleString('en-IN')}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
