'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { LogOut, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { useUserStore } from '@/store/user.store';

type NavLink = { href: string; label: string };

interface NavbarProps {
    links: NavLink[];
    portalLabel: string;
    portalColor?: 'blue' | 'orange' | 'purple';
}

const portalBadgeStyles: Record<string, string> = {
    blue: 'bg-blue/10 text-blue border-blue/20',
    orange: 'bg-accent/10 text-accent border-accent/20', // orange mapped to accent(amber)
    purple: 'bg-admin/10 text-admin border-admin/20', // purple mapped to admin(indigo)
};

export function Navbar({ links, portalLabel, portalColor = 'blue' }: NavbarProps) {
    const pathname = usePathname();
    const router = useRouter();
    const user = useUserStore((state) => state.user);
    const clearUser = useUserStore((state) => state.clearUser);
    const [isLoggingOut, setIsLoggingOut] = useState(false);

    const handleLogout = async () => {
        setIsLoggingOut(true);
        try {
            await api.post('/api/v1/auth/logout');
        } catch { /* Ignore */ } finally {
            clearUser();
            router.replace('/login');
            setIsLoggingOut(false);
        }
    };

    return (
        <header className="sticky top-0 z-50 border-b border-border-subtle bg-surface/80 backdrop-blur-xl">
            <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-6 py-3">
                {/* Logo + Badge */}
                <div className="flex items-center gap-3">
                    <Link href="/" className="text-lg font-bold tracking-tight">
                        <span className="text-text-primary">Build</span>
                        <span className="text-accent">Mart</span>
                    </Link>
                    <span className={cn(
                        'hidden sm:inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium',
                        portalBadgeStyles[portalColor],
                    )}>
                        {portalLabel}
                    </span>
                </div>

                {/* Right section */}
                <div className="flex items-center gap-3">
                    {user && (
                        <span className="hidden sm:block text-sm text-text-secondary truncate max-w-[150px]">
                            {user.name ?? user.phone}
                        </span>
                    )}
                    <button
                        type="button"
                        onClick={handleLogout}
                        disabled={isLoggingOut}
                        aria-label="Logout"
                        className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-text-tertiary hover:text-danger transition-colors disabled:opacity-50"
                    >
                        {isLoggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                        <span className="hidden sm:inline">{isLoggingOut ? 'Logging out…' : 'Logout'}</span>
                    </button>
                </div>
            </div>

            {/* Nav links */}
            <nav className="border-t border-border-subtle/50">
                <div className="mx-auto flex w-full max-w-7xl gap-2 overflow-x-auto px-6 py-2">
                    {links.map((link) => {
                        const isActive = pathname === link.href || pathname.startsWith(link.href + '/');

                        let activeStyle = 'bg-elevated/80 text-text-primary shadow-sm ring-1 ring-border-strong';
                        if (isActive) {
                            switch (portalColor) {
                                case 'blue': activeStyle = 'bg-blue/15 text-blue ring-1 ring-blue/30'; break;
                                case 'purple': activeStyle = 'bg-admin/15 text-admin ring-1 ring-admin/30'; break;
                                case 'orange':
                                default: activeStyle = 'bg-accent/15 text-accent ring-1 ring-accent/30'; break;
                            }
                        }

                        return (
                            <Link
                                key={link.href}
                                href={link.href}
                                className={cn(
                                    'shrink-0 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all duration-200',
                                    isActive
                                        ? activeStyle
                                        : 'text-text-secondary hover:text-text-primary hover:bg-elevated/60',
                                )}
                            >
                                {link.label}
                            </Link>
                        );
                    })}
                </div>
            </nav>
        </header>
    );
}
