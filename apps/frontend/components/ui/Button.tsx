'use client';

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    size?: ButtonSize;
    loading?: boolean;
    children: ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
    primary:
        'bg-accent text-white hover:bg-accent-hover btn-glow font-semibold',
    secondary:
        'bg-elevated text-text-primary border border-border hover:border-border-strong hover:bg-elevated/80 font-medium',
    ghost:
        'text-text-secondary hover:text-text-primary hover:bg-elevated/60 font-medium',
    danger:
        'bg-danger/10 text-danger border border-danger/20 hover:bg-danger/20 font-medium',
};

const sizeClasses: Record<ButtonSize, string> = {
    sm: 'h-8 px-3 text-xs gap-1.5 rounded-lg',
    md: 'h-10 px-4 text-sm gap-2 rounded-xl',
    lg: 'h-12 px-6 text-sm gap-2 rounded-xl',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    ({ variant = 'primary', size = 'md', loading, className, disabled, children, ...props }, ref) => {
        return (
            <button
                ref={ref}
                disabled={disabled || loading}
                className={cn(
                    'inline-flex items-center justify-center transition-all duration-200',
                    'disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none',
                    variantClasses[variant],
                    sizeClasses[size],
                    className,
                )}
                {...props}
            >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {children}
            </button>
        );
    },
);

Button.displayName = 'Button';
