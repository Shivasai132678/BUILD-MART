'use client';

import { cn } from '@/lib/utils';

type CardVariant = 'default' | 'elevated' | 'flat';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    variant?: CardVariant;
    children: React.ReactNode;
}

const variantStyles: Record<CardVariant, string> = {
    default: 'card',
    elevated: 'card hover:shadow-lg transition-shadow duration-300',
    flat: 'bg-surface border border-border-strong',
};

export function Card({
    variant = 'default',
    className,
    children,
    ...props
}: CardProps) {
    return (
        <div
            className={cn(
                'rounded-2xl overflow-hidden',
                variantStyles[variant],
                className,
            )}
            {...props}
        >
            {children}
        </div>
    );
}

export function CardHeader({
    className,
    children,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div className={cn('px-5 pt-5 pb-3', className)} {...props}>
            {children}
        </div>
    );
}

export function CardContent({
    className,
    children,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div className={cn('px-5 pb-5', className)} {...props}>
            {children}
        </div>
    );
}
