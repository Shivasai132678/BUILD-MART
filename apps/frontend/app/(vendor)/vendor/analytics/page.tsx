'use client';

import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { getVendorStats, getVendorDisputes, type VendorStats } from '@/lib/vendor-api';
import { getApiErrorMessage } from '@/lib/api';
import { formatIST } from '@/lib/utils/date';
import { formatINR } from '@/lib/utils/money';
import { PageTransition, StaggerContainer, StaggerItem } from '@/components/ui/Motion';

function StatCard({ label, value, icon, color = 'blue', sub }: {
  label: string;
  value: string | number;
  icon: string;
  color?: 'blue' | 'green' | 'amber' | 'purple';
  sub?: string;
}) {
  const colorMap = {
    blue: 'bg-[#3B7FC1]/15 text-[#60A5FA]',
    green: 'bg-green-500/15 text-green-400',
    amber: 'bg-amber-500/15 text-amber-400',
    purple: 'bg-purple-500/15 text-purple-400',
  };
  return (
    <div className="bg-[#1E2A3A] border border-[#253347] rounded-2xl p-5 hover:border-[#3B7FC1]/30 transition-all duration-300">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${colorMap[color]}`}>
        <span className="material-symbols-outlined text-[20px]">{icon}</span>
      </div>
      <p className="text-2xl font-bold text-[#E2EAF4]">{value}</p>
      <p className="text-sm text-[#8EA5C0] mt-0.5">{label}</p>
      {sub && <p className="text-xs text-[#4A6080] mt-1">{sub}</p>}
    </div>
  );
}

function DisputeStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    OPEN: 'bg-orange-500/15 text-orange-400 border border-orange-500/30',
    RESOLVED: 'bg-green-500/15 text-green-400 border border-green-500/30',
    CLOSED: 'bg-[#253347] text-[#4A6080] border border-[#253347]',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${map[status] ?? ''}`}>
      {status}
    </span>
  );
}

export default function VendorAnalyticsPage() {
  const statsQuery = useQuery({ queryKey: ['vendor-stats'], queryFn: () => getVendorStats() });
  const disputesQuery = useQuery({ queryKey: ['vendor-disputes'], queryFn: () => getVendorDisputes(5, 0) });

  const stats: VendorStats | undefined = statsQuery.data;
  const disputes = disputesQuery.data?.items ?? [];

  return (
    <PageTransition className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#E2EAF4]">Analytics</h1>
        <p className="text-sm text-[#8EA5C0] mt-0.5">Your business performance at a glance</p>
      </div>

      {/* Stats grid */}
      {statsQuery.isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-[#1E2A3A] border border-[#253347] rounded-2xl h-28 animate-pulse" />
          ))}
        </div>
      ) : statsQuery.isError ? (
        <div className="bg-[#1E2A3A] border border-[#253347] rounded-2xl p-8 text-center">
          <span className="material-symbols-outlined text-3xl text-[#4A6080]">error</span>
          <p className="mt-2 text-sm text-[#8EA5C0]">{getApiErrorMessage(statsQuery.error)}</p>
        </div>
      ) : stats ? (
        <StaggerContainer className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StaggerItem>
            <StatCard label="Total Orders" value={stats.totalOrders} icon="package_2" color="blue" />
          </StaggerItem>
          <StaggerItem>
            <StatCard label="Delivered" value={stats.deliveredOrders} icon="inventory" color="green" sub={`${stats.totalOrders > 0 ? Math.round((stats.deliveredOrders / stats.totalOrders) * 100) : 0}% completion rate`} />
          </StaggerItem>
          <StaggerItem>
            <StatCard label="Pending" value={stats.pendingOrders} icon="schedule" color="amber" />
          </StaggerItem>
          <StaggerItem>
            <StatCard label="Total Revenue" value={formatINR(stats.totalRevenue)} icon="payments" color="green" />
          </StaggerItem>
          <StaggerItem>
            <StatCard
              label="Avg Rating"
              value={stats.averageRating ? Number(stats.averageRating).toFixed(1) : '—'}
              icon="star"
              color="amber"
              sub={stats.totalReviews > 0 ? `${stats.totalReviews} review${stats.totalReviews !== 1 ? 's' : ''}` : 'No reviews yet'}
            />
          </StaggerItem>
          <StaggerItem>
            <StatCard label="Open RFQs" value={stats.openRfqs} icon="request_quote" color="blue" />
          </StaggerItem>
          <StaggerItem>
            <StatCard label="Total Quotes" value={stats.totalQuotes} icon="description" color="purple" />
          </StaggerItem>
          <StaggerItem>
            <StatCard
              label="Quote Win Rate"
              value={stats.totalQuotes > 0 ? `${Math.round((stats.totalOrders / stats.totalQuotes) * 100)}%` : '—'}
              icon="trending_up"
              color="green"
              sub="Orders / Total quotes"
            />
          </StaggerItem>
        </StaggerContainer>
      ) : null}

      {/* Rating breakdown */}
      {stats && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.2 }}
          className="bg-[#1E2A3A] border border-[#253347] rounded-2xl p-6"
        >
          <h2 className="text-lg font-semibold text-[#E2EAF4] mb-4">Performance Overview</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            {[
              { label: 'Delivery Rate', numerator: stats.deliveredOrders, denominator: stats.totalOrders, color: 'text-green-400' },
              { label: 'Active Orders', numerator: stats.pendingOrders, denominator: stats.totalOrders, color: 'text-amber-400' },
            ].map(({ label, numerator, denominator, color }) => {
              const pct = denominator > 0 ? Math.round((numerator / denominator) * 100) : 0;
              return (
                <div key={label} className="bg-[#111827] rounded-xl p-4">
                  <div className="relative h-16 w-16 mx-auto mb-2">
                    <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90">
                      <circle cx="18" cy="18" r="14" fill="none" stroke="#253347" strokeWidth="3" />
                      <circle
                        cx="18" cy="18" r="14" fill="none"
                        className={color.replace('text-', 'stroke-')}
                        strokeWidth="3"
                        strokeDasharray={`${pct * 0.88} 88`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <span className={`absolute inset-0 flex items-center justify-center text-sm font-bold ${color}`}>{pct}%</span>
                  </div>
                  <p className="text-xs text-[#8EA5C0]">{label}</p>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Recent disputes */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.3 }}
        className="bg-[#1E2A3A] border border-[#253347] rounded-2xl p-6"
      >
        <h2 className="text-lg font-semibold text-[#E2EAF4] mb-4">Recent Disputes</h2>
        {disputesQuery.isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 bg-[#111827] rounded-xl animate-pulse" />
            ))}
          </div>
        ) : disputes.length === 0 ? (
          <div className="text-center py-8">
            <span className="material-symbols-outlined text-3xl text-[#253347]">report_problem</span>
            <p className="mt-2 text-sm text-[#8EA5C0]">No disputes filed against your orders.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {disputes.map((dispute) => (
              <div key={dispute.id} className="flex items-start gap-3 bg-[#111827] border border-[#253347] rounded-xl px-4 py-3">
                <span className="material-symbols-outlined text-orange-400 text-[18px] mt-0.5 shrink-0">report_problem</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className="font-mono text-xs text-[#4A6080]">#{dispute.orderId.slice(0, 8)}</span>
                    <DisputeStatusBadge status={dispute.status} />
                  </div>
                  <p className="text-sm font-medium text-[#E2EAF4] truncate">{dispute.reason}</p>
                  <p className="text-xs text-[#4A6080] mt-0.5">{formatIST(dispute.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </PageTransition>
  );
}
