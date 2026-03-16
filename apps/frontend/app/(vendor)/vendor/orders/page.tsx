'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { getVendorOrders } from '@/lib/vendor-api';
import type { Order } from '@/lib/buyer-api';
import { formatIST } from '@/lib/utils/date';

type StatusFilter = Order['status'] | 'ALL';

const STATUS_TABS: Array<{ label: string; value: StatusFilter }> = [
  { label: 'All', value: 'ALL' },
  { label: 'Confirmed', value: 'CONFIRMED' },
  { label: 'In Transit', value: 'OUT_FOR_DELIVERY' },
  { label: 'Delivered', value: 'DELIVERED' },
  { label: 'Cancelled', value: 'CANCELLED' },
];

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; classes: string }> = {
    CONFIRMED:        { label: 'Confirmed',  classes: 'bg-green-500/15 text-green-400 border border-green-500/30' },
    OUT_FOR_DELIVERY: { label: 'In Transit', classes: 'bg-[#3B7FC1]/15 text-[#60A5FA] border border-[#3B7FC1]/30' },
    DELIVERED:        { label: 'Delivered',  classes: 'bg-green-600/15 text-green-300 border border-green-600/30' },
    CANCELLED:        { label: 'Cancelled',  classes: 'bg-red-500/10 text-red-400 border border-red-500/20' },
  };
  const { label, classes } = map[status] ?? { label: status, classes: 'bg-[#4A6080]/20 text-[#8EA5C0]' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${classes}`}>
      {label}
    </span>
  );
}

const PAGE_SIZE = 20;

export default function VendorOrdersPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');

  const ordersQuery = useQuery({
    queryKey: ['vendor-orders', statusFilter],
    queryFn: () =>
      getVendorOrders(PAGE_SIZE, 0, statusFilter === 'ALL' ? undefined : statusFilter),
  });

  const items = ordersQuery.data?.items ?? [];
  const total = ordersQuery.data?.total ?? 0;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">My Orders</h1>
        <p className="text-[#8EA5C0] text-sm mt-1">
          {total} order{total !== 1 ? 's' : ''}
          {statusFilter !== 'ALL' && ` · filtered by ${STATUS_TABS.find((t) => t.value === statusFilter)?.label}`}
        </p>
      </div>

      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={`px-4 py-1.5 rounded-xl text-sm font-medium transition-colors ${
              statusFilter === tab.value
                ? 'bg-blue text-white'
                : 'bg-[#111827] text-[#8EA5C0] hover:text-text-primary border border-[#1E2A3A]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* List */}
      {ordersQuery.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-[#111827] border border-[#1E2A3A] rounded-2xl h-20 animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="bg-[#111827] border border-[#1E2A3A] rounded-2xl flex flex-col items-center justify-center py-20 text-center px-6">
          <span className="material-symbols-outlined text-[56px] text-[#1E2A3A] mb-4">package_2</span>
          <p className="font-medium text-text-primary">No orders found</p>
          <p className="text-sm text-[#8EA5C0] mt-1">
            {statusFilter === 'ALL'
              ? 'Orders will appear here when buyers accept your quotes.'
              : `No orders with status "${STATUS_TABS.find((t) => t.value === statusFilter)?.label}".`}
          </p>
          {statusFilter !== 'ALL' && (
            <button
              onClick={() => setStatusFilter('ALL')}
              className="mt-4 text-sm text-blue hover:underline"
            >
              View all orders
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((order) => (
            <Link
              key={order.id}
              href={`/vendor/orders/${order.id}`}
              className="bg-[#111827] border border-[#1E2A3A] hover:border-blue/30 rounded-2xl flex items-center gap-4 px-5 py-4 group transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-blue/15 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-blue text-[20px]">package_2</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="font-mono text-xs text-blue">
                    {order.referenceCode ?? `#${order.id.slice(0, 10)}`}
                  </span>
                  <StatusBadge status={order.status} />
                </div>
                <p className="text-sm text-[#8EA5C0]">{formatIST(order.createdAt)}</p>
              </div>
              <p className="text-lg font-bold text-text-primary">₹{order.totalAmount}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
