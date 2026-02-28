'use client';

import type { ReactNode } from 'react';
import { type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface StatCardProps {
    icon: LucideIcon;
    label: string;
    value: string | number;
    href?: string;
    trend?: { value: string; positive: boolean };
    iconColorClass?: string;
}

export function StatCard({
    icon: Icon,
    label,
    value,
    href,
    trend,
    iconColorClass = 'bg-accent/10 text-accent',
}: StatCardProps) {
    const content = (
        <div className="card p-5 group">
            <div className={cn('inline-flex rounded-lg p-2', iconColorClass)}>
                <Icon className="h-5 w-5" />
            </div>
            <p className="mt-3 text-3xl font-bold text-text-primary">{value}</p>
            <div className="mt-1 flex items-center gap-2">
                <p className="text-sm text-text-secondary">{label}</p>
                {trend && (
                    <span
                        className={cn(
                            'text-xs font-semibold',
                            trend.positive ? 'text-success' : 'text-danger',
                        )}
                    >
                        {trend.positive ? '↑' : '↓'} {trend.value}
                    </span>
                )}
            </div>
        </div>
    );

    if (href) {
        return <Link href={href}>{content}</Link>;
    }
    return content;
}
