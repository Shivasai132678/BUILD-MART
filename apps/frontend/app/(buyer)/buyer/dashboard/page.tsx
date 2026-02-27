'use client';

import { useQueries, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { Spinner } from '@/components/ui/Spinner';
import { fetchBuyerOrders, fetchBuyerRfqs } from '@/lib/buyer-api';
import { formatIST } from '@/lib/utils/date';
import { useUserStore } from '@/store/user.store';

function StatCard({
  label,
  value,
  href,
  accent,
}: {
  label: string;
  value: number;
  href: string;
  accent: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow"
    >
      <p className="text-sm text-slate-600">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${accent}`}>{value}</p>
    </Link>
  );
}

export default function BuyerDashboardPage() {
  const user = useUserStore((state) => state.user);

  const recentRfqsQuery = useQuery({
    queryKey: ['buyer-rfqs', 'recent'],
    queryFn: () => fetchBuyerRfqs(5, 0),
  });

  const orderCountQueries = useQueries({
    queries: [
      {
        queryKey: ['buyer-orders', 'confirmed-count'],
        queryFn: () => fetchBuyerOrders(1, 0, 'CONFIRMED'),
      },
      {
        queryKey: ['buyer-orders', 'out-for-delivery-count'],
        queryFn: () => fetchBuyerOrders(1, 0, 'OUT_FOR_DELIVERY'),
      },
      {
        queryKey: ['buyer-orders', 'delivered-count'],
        queryFn: () => fetchBuyerOrders(1, 0, 'DELIVERED'),
      },
    ],
  });

  const isLoadingStats =
    recentRfqsQuery.isLoading || orderCountQueries.some((query) => query.isLoading);
  const statsError =
    (recentRfqsQuery.error as Error | null)?.message ??
    (orderCountQueries.find((query) => query.error)?.error as Error | undefined)
      ?.message;

  const rfqTotal = recentRfqsQuery.data?.total ?? 0;
  const confirmedCount = orderCountQueries[0]?.data?.total ?? 0;
  const outForDeliveryCount = orderCountQueries[1]?.data?.total ?? 0;
  const deliveredCount = orderCountQueries[2]?.data?.total ?? 0;
  const activeOrders = confirmedCount + outForDeliveryCount;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm text-slate-500">Welcome back</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">
          {user?.name ?? 'Buyer'}
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Track your RFQs, compare quotes, and follow your order progress.
        </p>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {isLoadingStats ? (
          <div className="col-span-full flex items-center justify-center rounded-2xl border border-slate-200 bg-white p-8">
            <div className="flex items-center gap-3 text-sm text-slate-700">
              <Spinner size="sm" />
              Loading dashboard stats...
            </div>
          </div>
        ) : (
          <>
            <StatCard
              label="My RFQs"
              value={rfqTotal}
              href="/buyer/dashboard#my-rfqs"
              accent="text-blue-700"
            />
            <StatCard
              label="Active Orders"
              value={activeOrders}
              href="/buyer/orders"
              accent="text-amber-700"
            />
            <StatCard
              label="Delivered Orders"
              value={deliveredCount}
              href="/buyer/orders"
              accent="text-emerald-700"
            />
          </>
        )}
      </section>

      <ErrorMessage message={statsError ?? null} />

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Link
          href="/buyer/rfq/new"
          className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 shadow-sm transition hover:border-slate-300"
        >
          Create RFQ
        </Link>
        <Link
          href="/buyer/dashboard#my-rfqs"
          className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 shadow-sm transition hover:border-slate-300"
        >
          My RFQs
        </Link>
        <Link
          href="/buyer/orders"
          className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 shadow-sm transition hover:border-slate-300"
        >
          My Orders
        </Link>
      </section>

      <section
        id="my-rfqs"
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">Recent RFQs</h2>
          <span className="text-sm text-slate-500">
            {recentRfqsQuery.data?.total ?? 0} total
          </span>
        </div>

        {recentRfqsQuery.isLoading ? (
          <div className="flex items-center gap-3 text-sm text-slate-700">
            <Spinner size="sm" />
            Loading RFQs...
          </div>
        ) : recentRfqsQuery.data && recentRfqsQuery.data.items.length > 0 ? (
          <div className="space-y-3">
            {recentRfqsQuery.data.items.map((rfq) => (
              <Link
                key={rfq.id}
                href={`/buyer/rfq/${rfq.id}`}
                className="block rounded-xl border border-slate-200 px-4 py-3 transition hover:border-slate-300"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-slate-900">
                    RFQ #{rfq.id.slice(0, 8)}
                  </p>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                    {rfq.status}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  {rfq.city} • {rfq.items.length} item{rfq.items.length === 1 ? '' : 's'}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Created {formatIST(rfq.createdAt)} • Valid until {formatIST(rfq.validUntil)}
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-600">
            No RFQs yet. Create your first RFQ to start receiving quotes.
          </div>
        )}
      </section>
    </div>
  );
}

