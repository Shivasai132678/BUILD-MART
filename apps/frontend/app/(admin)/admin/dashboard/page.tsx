'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { Spinner } from '@/components/ui/Spinner';
import { getApiErrorMessage } from '@/lib/api';
import { getMetrics, type AdminMetrics } from '@/lib/admin-api';

type MetricCardConfig = {
  key: 'users' | 'vendors' | 'rfqs' | 'orders' | 'gmv';
  label: string;
  icon: string;
  className: string;
};

const METRIC_CARD_CONFIGS: MetricCardConfig[] = [
  { key: 'users', label: 'Total Users', icon: 'U', className: 'text-blue-700' },
  {
    key: 'vendors',
    label: 'Total Approved Vendors',
    icon: 'V',
    className: 'text-emerald-700',
  },
  { key: 'rfqs', label: 'Total RFQs', icon: 'R', className: 'text-amber-700' },
  { key: 'orders', label: 'Total Orders', icon: 'O', className: 'text-indigo-700' },
  { key: 'gmv', label: 'GMV', icon: 'G', className: 'text-rose-700' },
];

function formatMetricValue(key: MetricCardConfig['key'], metrics?: AdminMetrics): string {
  if (!metrics) {
    return 'N/A';
  }

  if (key === 'users') {
    return String(metrics.totalUsers ?? 'N/A');
  }
  if (key === 'vendors') {
    return String(metrics.totalVendors ?? 'N/A');
  }
  if (key === 'rfqs') {
    return String(metrics.totalRfqs ?? 'N/A');
  }
  if (key === 'orders') {
    return String(metrics.totalOrders ?? 'N/A');
  }
  if (key === 'gmv') {
    if (metrics.gmv === undefined || metrics.gmv === null) {
      return 'N/A';
    }
    return `₹${metrics.gmv}`;
  }

  return 'N/A';
}

function MetricCard({
  icon,
  label,
  value,
  accentClass,
}: {
  icon: string;
  label: string;
  value: string;
  accentClass: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold ${accentClass}`}
        >
          {icon}
        </div>
        <div>
          <p className="text-sm text-slate-600">{label}</p>
          <p className={`mt-1 text-xl font-semibold ${accentClass}`}>{value}</p>
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  const metricsQuery = useQuery({
    queryKey: ['admin-metrics'],
    queryFn: getMetrics,
    retry: false,
  });

  const metricsUnavailable =
    metricsQuery.isError || (metricsQuery.isFetched && !metricsQuery.data);

  const metricsErrorMessage = metricsQuery.isError
    ? getApiErrorMessage(metricsQuery.error, 'Admin metrics endpoint pending')
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Admin Dashboard</h1>
          <p className="mt-1 text-sm text-slate-600">
            Metrics overview and vendor approvals queue.
          </p>
        </div>

        <Link
          href="/admin/vendors"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          Vendor Approvals
        </Link>
      </div>

      {metricsQuery.isLoading ? (
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm text-sm text-slate-700">
          <Spinner size="sm" />
          Loading admin metrics...
        </div>
      ) : null}

      {metricsUnavailable ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Admin metrics endpoint pending
        </div>
      ) : null}

      <ErrorMessage message={metricsErrorMessage} />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {METRIC_CARD_CONFIGS.map((card) => (
          <MetricCard
            key={card.key}
            icon={card.icon}
            label={card.label}
            value={formatMetricValue(card.key, metricsQuery.data)}
            accentClass={card.className}
          />
        ))}
      </section>
    </div>
  );
}
