'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { getAllOrders, forceCancelOrder, type AdminOrder } from '@/lib/admin-api';
import { getApiErrorMessage } from '@/lib/api';
import { formatIST } from '@/lib/utils/date';
import { formatINR } from '@/lib/utils/money';

const PAGE_SIZE = 20;

const ORDER_STATUS_STYLES: Record<string, string> = {
  CONFIRMED: 'bg-green-500/15 text-green-400 border border-green-500/30',
  OUT_FOR_DELIVERY: 'bg-blue-500/15 text-blue-400 border border-blue-500/30',
  DELIVERED: 'bg-green-600/15 text-green-300 border border-green-600/30',
  CANCELLED: 'bg-red-500/10 text-red-400 border border-red-500/20',
};

const ORDER_STATUSES = ['', 'CONFIRMED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'] as const;
type OrderStatusFilter = (typeof ORDER_STATUSES)[number];

function StatusBadge({ status }: { status: string }) {
  const cls = ORDER_STATUS_STYLES[status] ?? 'bg-[#3A3027]/50 text-[#A89F91] border border-[#3A3027]';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${cls}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

function ForceCancelButton({ order, onDone }: { order: AdminOrder; onDone: () => void }) {
  const mutation = useMutation({
    mutationFn: () => forceCancelOrder(order.id),
    onSuccess: () => {
      toast.success(`Order ${order.id.slice(0, 8)} cancelled`);
      onDone();
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Failed to cancel order.'));
    },
  });

  if (order.status === 'CANCELLED' || order.status === 'DELIVERED') return null;

  return (
    <button
      type="button"
      disabled={mutation.isPending}
      onClick={() => void mutation.mutate()}
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-all disabled:opacity-60"
    >
      <span className="material-symbols-outlined text-[14px]">cancel</span>
      {mutation.isPending ? 'Cancelling…' : 'Force Cancel'}
    </button>
  );
}

export default function AdminOrdersPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<OrderStatusFilter>('');
  const [offset, setOffset] = useState(0);

  const ordersQuery = useQuery({
    queryKey: ['admin-orders', statusFilter, offset],
    queryFn: () => getAllOrders(PAGE_SIZE, offset, statusFilter || undefined),
  });

  const orders = ordersQuery.data?.items ?? [];
  const total = ordersQuery.data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  function handleStatusChange(newStatus: OrderStatusFilter) {
    setStatusFilter(newStatus);
    setOffset(0);
  }

  function handleRefresh() {
    void queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#F5F0E8]">Order Oversight</h1>
          <p className="mt-1 text-sm text-[#A89F91]">View and manage all platform orders.</p>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-[#A89F91] hover:text-[#F5F0E8] border border-[#2A2520] hover:border-[#3A3027] transition-all"
        >
          <span className={`material-symbols-outlined text-[18px] ${ordersQuery.isFetching ? 'animate-spin' : ''}`}>refresh</span>
          Refresh
        </button>
      </div>

      {/* Status filter */}
      <div className="flex flex-wrap gap-2">
        {ORDER_STATUSES.map((s) => (
          <button
            key={s || 'all'}
            type="button"
            onClick={() => handleStatusChange(s)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              statusFilter === s
                ? 'bg-[#6764f2] text-white'
                : 'bg-[#211E19] text-[#A89F91] border border-[#2A2520] hover:border-[#3A3027]'
            }`}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      {/* Orders table */}
      <div className="bg-[#1A1714] border border-[#2A2520] rounded-2xl overflow-hidden">
        {ordersQuery.isLoading ? (
          <div className="space-y-px">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-14 bg-[#211E19] animate-pulse" />
            ))}
          </div>
        ) : ordersQuery.isError ? (
          <div className="p-12 text-center">
            <span className="material-symbols-outlined text-4xl text-[#7A7067]">error</span>
            <p className="mt-3 font-semibold text-[#F5F0E8]">Failed to load orders</p>
            <p className="mt-1 text-sm text-[#A89F91]">{getApiErrorMessage(ordersQuery.error)}</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="p-12 text-center">
            <span className="material-symbols-outlined text-4xl text-[#7A7067]">receipt_long</span>
            <p className="mt-3 font-semibold text-[#F5F0E8]">No orders found</p>
            <p className="mt-1 text-sm text-[#A89F91]">{statusFilter ? `No ${statusFilter.replace(/_/g, ' ').toLowerCase()} orders.` : 'No orders yet.'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2A2520]">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#7A7067] uppercase tracking-wide">Order ID</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#7A7067] uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-[#7A7067] uppercase tracking-wide">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#7A7067] uppercase tracking-wide">Created</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#7A7067] uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2A2520]">
                {orders.map((order: AdminOrder) => (
                  <tr key={order.id} className="hover:bg-[#211E19]/50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-[#A89F91]">#{order.id.slice(0, 12)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-[#F5F0E8]">
                      {formatINR(order.totalAmount)}
                    </td>
                    <td className="px-4 py-3 text-xs text-[#7A7067]">{formatIST(order.createdAt)}</td>
                    <td className="px-4 py-3">
                      <ForceCancelButton
                        order={order}
                        onDone={() => void queryClient.invalidateQueries({ queryKey: ['admin-orders'] })}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-[#A89F91]">
          <span>
            Page {currentPage} of {totalPages} · {total} orders total
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              className="px-3 py-1.5 rounded-xl text-xs font-medium border border-[#2A2520] hover:border-[#3A3027] disabled:opacity-40 transition-all"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={offset + PAGE_SIZE >= total}
              onClick={() => setOffset(offset + PAGE_SIZE)}
              className="px-3 py-1.5 rounded-xl text-xs font-medium border border-[#2A2520] hover:border-[#3A3027] disabled:opacity-40 transition-all"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
