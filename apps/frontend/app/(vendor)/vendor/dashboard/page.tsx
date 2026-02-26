'use client';

import { useQueries, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { Spinner } from '@/components/ui/Spinner';
import { getApiErrorMessage } from '@/lib/api';
import { getAvailableRfqs, getVendorOrders, getVendorProfile } from '@/lib/vendor-api';

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

export default function VendorDashboardPage() {
  const vendorProfileQuery = useQuery({
    queryKey: ['vendor-profile'],
    queryFn: getVendorProfile,
  });

  const countQueries = useQueries({
    queries: [
      {
        queryKey: ['vendor-available-rfqs-count'],
        queryFn: () => getAvailableRfqs(1, 0),
      },
      {
        queryKey: ['vendor-orders-count', 'CONFIRMED'],
        queryFn: () => getVendorOrders(1, 0, 'CONFIRMED'),
      },
      {
        queryKey: ['vendor-orders-count', 'OUT_FOR_DELIVERY'],
        queryFn: () => getVendorOrders(1, 0, 'OUT_FOR_DELIVERY'),
      },
      {
        queryKey: ['vendor-orders-count', 'DELIVERED'],
        queryFn: () => getVendorOrders(1, 0, 'DELIVERED'),
      },
    ],
  });

  const isLoading =
    vendorProfileQuery.isLoading || countQueries.some((query) => query.isLoading);

  const errorMessage =
    (vendorProfileQuery.isError &&
      getApiErrorMessage(vendorProfileQuery.error, 'Failed to load vendor profile.')) ||
    (countQueries.find((query) => query.isError)?.error &&
      getApiErrorMessage(
        countQueries.find((query) => query.isError)?.error,
        'Failed to load dashboard stats.',
      )) ||
    null;

  const availableRfqsCount = countQueries[0]?.data?.total ?? 0;
  const activeOrdersCount =
    (countQueries[1]?.data?.total ?? 0) + (countQueries[2]?.data?.total ?? 0);
  const deliveredOrdersCount = countQueries[3]?.data?.total ?? 0;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        {vendorProfileQuery.isLoading ? (
          <div className="flex items-center gap-3 text-sm text-slate-700">
            <Spinner size="sm" />
            Loading vendor profile...
          </div>
        ) : (
          <>
            <p className="text-sm text-slate-500">Welcome</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">
              {vendorProfileQuery.data?.businessName ?? 'Vendor'}
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Track new RFQs, submit quotes, and manage your delivery pipeline.
            </p>
          </>
        )}
      </section>

      {isLoading ? (
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm text-sm text-slate-700">
          <Spinner size="sm" />
          Loading dashboard stats...
        </div>
      ) : null}

      <ErrorMessage message={errorMessage} />

      {!isLoading ? (
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            label="Available RFQs"
            value={availableRfqsCount}
            href="/vendor/rfq"
            accent="text-emerald-700"
          />
          <StatCard
            label="Active Orders"
            value={activeOrdersCount}
            href="/vendor/orders"
            accent="text-amber-700"
          />
          <StatCard
            label="Delivered Orders"
            value={deliveredOrdersCount}
            href="/vendor/orders"
            accent="text-blue-700"
          />
        </section>
      ) : null}

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Link
          href="/vendor/rfq"
          className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 shadow-sm transition hover:border-slate-300"
        >
          View Available RFQs
        </Link>
        <Link
          href="/vendor/orders"
          className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 shadow-sm transition hover:border-slate-300"
        >
          Manage Orders
        </Link>
      </section>
    </div>
  );
}

