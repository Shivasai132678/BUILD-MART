import Link from 'next/link';
import { Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';
import { Button } from './Button';

interface EmptyStateProps {
    icon?: ReactNode;
    title: string;
    subtitle?: string;
    actionLabel?: string;
    actionHref?: string;
    className?: string;
    portalColor?: 'blue' | 'orange' | 'purple';
}

export function EmptyState({
    icon,
    title,
    subtitle,
    actionLabel,
    actionHref,
    className,
    portalColor = 'blue',
}: EmptyStateProps) {
    const buttonVariant = portalColor === 'blue' ? 'vendor' : portalColor === 'purple' ? 'admin' : 'primary';

    return (
        <div
            className={cn(
                'flex flex-col items-center justify-center rounded-2xl border border-border bg-surface px-6 py-16 text-center',
                className,
            )}
        >
            <div className="flex h-12 w-12 items-center justify-center auto-pulse rounded-xl bg-elevated text-text-secondary mb-4 ring-1 ring-border-subtle shadow-inner-glow">
                {icon ?? <Package className="h-6 w-6" />}
            </div>
            <h3 className="text-base font-semibold text-text-primary">{title}</h3>
            {subtitle && (
                <p className="mt-1.5 text-sm text-text-secondary max-w-sm">{subtitle}</p>
            )}
            {actionLabel && actionHref && (
                <div className="mt-6">
                    <Link href={actionHref}>
                        <Button variant={buttonVariant} size="sm">{actionLabel}</Button>
                    </Link>
                </div>
            )}
        </div>
    );
}
