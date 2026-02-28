'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Users, Store, FileText, ShoppingBag, IndianRupee, ArrowRight } from 'lucide-react';
import { getMetrics, type AdminMetrics } from '@/lib/admin-api';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { SkeletonStatCard } from '@/components/ui/Skeleton';
import { MotionContainer, StaggerContainer, StaggerItem } from '@/components/ui/Motion';
import { Button } from '@/components/ui/Button';

const metricConfigs = [
  { key: 'users' as const, label: 'Total Users', icon: Users },
  { key: 'vendors' as const, label: 'Approved Vendors', icon: Store },
  { key: 'rfqs' as const, label: 'Total RFQs', icon: FileText },
  { key: 'orders' as const, label: 'Total Orders', icon: ShoppingBag },
  { key: 'gmv' as const, label: 'GMV', icon: IndianRupee },
];

function getMetricValue(key: string, metrics?: AdminMetrics): string | number {
  if (!metrics) return 'N/A';
  switch (key) {
    case 'users': return metrics.totalUsers ?? 'N/A';
    case 'vendors': return metrics.totalVendors ?? 'N/A';
    case 'rfqs': return metrics.totalRfqs ?? 'N/A';
    case 'orders': return metrics.totalOrders ?? 'N/A';
    case 'gmv': return metrics.gmv != null ? `₹${Number(metrics.gmv).toLocaleString('en-IN')}` : 'N/A';
    default: return 'N/A';
  }
}

export default function AdminDashboardPage() {
  const metricsQuery = useQuery({
    queryKey: ['admin-metrics'],
    queryFn: getMetrics,
    retry: false,
  });

  const metricsUnavailable = metricsQuery.isError || (metricsQuery.isFetched && !metricsQuery.data);

  return (
    <div className="space-y-8">
      <MotionContainer>
        <PageHeader
          title="Admin Dashboard"
          subtitle="Platform metrics overview and management"
          action={
            <Link href="/admin/vendors">
              <Button variant="primary" size="sm">
                Vendor Approvals
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          }
        />
      </MotionContainer>

      {metricsUnavailable && (
        <MotionContainer delay={0.05}>
          <div className="rounded-2xl bg-amber-50 border border-amber-200 px-5 py-4 text-sm text-amber-800">
            Admin metrics endpoint is not available or returned an error. Some data may be incomplete.
          </div>
        </MotionContainer>
      )}

      {metricsQuery.isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 5 }).map((_, i) => <SkeletonStatCard key={i} />)}
        </div>
      ) : (
        <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {metricConfigs.map((config) => (
            <StaggerItem key={config.key}>
              <StatCard
                icon={config.icon}
                label={config.label}
                value={getMetricValue(config.key, metricsQuery.data)}
              />
            </StaggerItem>
          ))}
        </StaggerContainer>
      )}
    </div>
  );
}
