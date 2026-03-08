'use client';

import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    icon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
    ({ label, error, icon, className, id, ...props }, ref) => {
        return (
            <div className="space-y-1.5">
                {label && (
                    <label
                        htmlFor={id}
                        className="block text-sm font-medium text-text-primary"
                    >
                        {label}
                    </label>
                )}
                <div className="relative">
                    {icon && (
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-text-tertiary">
                            {icon}
                        </div>
                    )}
                    <input
                        ref={ref}
                        id={id}
                        className={cn(
                            'w-full rounded-xl border border-border bg-elevated',
                            'px-4 py-2.5 text-sm text-text-primary',
                            'placeholder:text-text-tertiary',
                            'transition-all duration-200',
                            'focus:ring-2 focus:ring-accent/20 focus:border-accent focus:outline-none',
                            'disabled:opacity-50 disabled:cursor-not-allowed',
                            icon && 'pl-10',
                            error && 'border-danger focus:ring-danger/20 focus:border-danger',
                            className,
                        )}
                        {...props}
                    />
                </div>
                {error && (
                    <p className="text-xs text-danger font-medium">{error}</p>
                )}
            </div>
        );
    },
);

Input.displayName = 'Input';
