import { cn } from '@/lib/utils';

const statusColors: Record<string, string> = {
    OPEN: 'bg-accent/10 text-accent border-accent/20',
    PENDING: 'bg-warning/10 text-warning border-warning/20',
    PENDING_APPROVAL: 'bg-warning/10 text-warning border-warning/20',
    CONFIRMED: 'bg-accent/10 text-accent border-accent/20',
    APPROVED: 'bg-success/10 text-success border-success/20',
    OUT_FOR_DELIVERY: 'bg-blue/10 text-blue border-blue/20',
    DELIVERED: 'bg-success/10 text-success border-success/20',
    CANCELLED: 'bg-danger/10 text-danger border-danger/20',
    CLOSED: 'bg-danger/10 text-danger border-danger/20',
    SUCCESS: 'bg-success/10 text-success border-success/20',
    FAILED: 'bg-danger/10 text-danger border-danger/20',
    DRAFT: 'bg-elevated text-text-tertiary border-border',
};

const dotColors: Record<string, string> = {
    OPEN: 'bg-accent',
    PENDING: 'bg-warning',
    PENDING_APPROVAL: 'bg-warning',
    CONFIRMED: 'bg-accent',
    APPROVED: 'bg-success',
    OUT_FOR_DELIVERY: 'bg-blue',
    DELIVERED: 'bg-success',
    CANCELLED: 'bg-danger',
    CLOSED: 'bg-danger',
    SUCCESS: 'bg-success',
    FAILED: 'bg-danger',
    DRAFT: 'bg-text-tertiary',
};

type BadgeProps = {
    status: string;
    className?: string;
};

export function Badge({ status, className }: BadgeProps) {
    const key = status.toUpperCase().replace(/ /g, '_');
    const colorClass = statusColors[key] ?? statusColors.DRAFT;
    const dotClass = dotColors[key] ?? dotColors.DRAFT;

    return (
        <span
            className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold',
                colorClass,
                className,
            )}
        >
            <span className={cn('h-1.5 w-1.5 rounded-full', dotClass)} />
            {status.replace(/_/g, ' ')}
        </span>
    );
}
