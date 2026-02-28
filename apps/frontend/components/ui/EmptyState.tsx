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
}

export function EmptyState({
    icon,
    title,
    subtitle,
    actionLabel,
    actionHref,
    className,
}: EmptyStateProps) {
    return (
        <div
            className={cn(
                'flex flex-col items-center justify-center rounded-2xl border border-border-subtle bg-surface px-6 py-16 text-center',
                className,
            )}
        >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-elevated text-text-tertiary mb-4">
                {icon ?? <Package className="h-6 w-6" />}
            </div>
            <h3 className="text-base font-semibold text-text-primary">{title}</h3>
            {subtitle && (
                <p className="mt-1.5 text-sm text-text-secondary max-w-sm">{subtitle}</p>
            )}
            {actionLabel && actionHref && (
                <div className="mt-5">
                    <Link href={actionHref}>
                        <Button variant="primary" size="sm">{actionLabel}</Button>
                    </Link>
                </div>
            )}
        </div>
    );
}
