import type { ReactNode } from 'react';

interface PageHeaderProps {
    title: string;
    subtitle?: string;
    action?: ReactNode;
}

export function PageHeader({ title, subtitle, action }: PageHeaderProps) {
    return (
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border-subtle pb-6 mb-8">
            <div>
                <h1 className="text-2xl font-bold text-text-primary">{title}</h1>
                {subtitle && <p className="mt-1 text-sm text-text-secondary">{subtitle}</p>}
            </div>
            {action && <div className="flex items-center gap-2">{action}</div>}
        </div>
    );
}
