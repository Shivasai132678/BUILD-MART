'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useRef, useEffect } from 'react';
import { fetchNotifications, getUnreadCount, markAllNotificationsRead } from '@/lib/notification-api';
import { formatIST } from '@/lib/utils/date';

interface NotificationBellProps {
  accentColor?: string;
  hoverBg?: string;
  /** 'up' opens above the button (for bottom-of-sidebar placement), 'down' opens below */
  dropdownPosition?: 'up' | 'down';
  /** 'right' aligns dropdown to button's right edge (default); 'left' aligns to left edge (use in left-side sidebars) */
  dropdownAlign?: 'left' | 'right';
}

export function NotificationBell({
  accentColor = '#D97706',
  hoverBg = 'hover:bg-[#211E19]',
  dropdownPosition = 'up',
  dropdownAlign = 'right',
}: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [open]);

  const unreadQuery = useQuery({
    queryKey: ['notifications-unread-count'],
    queryFn: getUnreadCount,
    refetchInterval: 30_000,
  });

  const listQuery = useQuery({
    queryKey: ['notifications-list'],
    queryFn: () => fetchNotifications(10, 0),
    enabled: open,
  });

  const markAllMutation = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
      void queryClient.invalidateQueries({ queryKey: ['notifications-list'] });
    },
  });

  const count = unreadQuery.data?.count ?? 0;
  const items = listQuery.data?.items ?? [];

  const alignCls = dropdownAlign === 'left' ? 'left-0' : 'right-0';
  const positionCls =
    dropdownPosition === 'up'
      ? `bottom-full mb-2 ${alignCls}`
      : `top-full mt-2 ${alignCls}`;

  return (
    <div className="relative shrink-0" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`relative p-1.5 rounded-xl text-[#A89F91] ${hoverBg} transition-colors`}
        aria-label={count > 0 ? `${count} unread notifications` : 'Notifications'}
      >
        <span className="material-symbols-outlined text-[20px]">notifications</span>
        {count > 0 && (
          <span
            className="absolute top-0.5 right-0.5 flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold text-white leading-none"
            style={{ backgroundColor: accentColor }}
          >
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div
          className={`absolute ${positionCls} w-80 rounded-2xl border border-[#2A2520] bg-surface shadow-2xl z-50 overflow-hidden`}
          style={{ minWidth: '18rem' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#2A2520]">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-text-primary">Notifications</span>
              {count > 0 && (
                <span
                  className="px-1.5 py-0.5 rounded-full text-[10px] font-bold text-white"
                  style={{ backgroundColor: accentColor }}
                >
                  {count}
                </span>
              )}
            </div>
            {count > 0 && (
              <button
                type="button"
                onClick={() => markAllMutation.mutate()}
                disabled={markAllMutation.isPending}
                className="text-xs text-[#7A7067] hover:text-text-primary transition-colors disabled:opacity-50"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Body */}
          <div className="max-h-72 overflow-y-auto">
            {listQuery.isLoading ? (
              <div className="p-4 space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 rounded-xl animate-pulse bg-elevated" />
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="py-10 text-center">
                <span className="material-symbols-outlined text-3xl text-[#3A3027]">
                  notifications_off
                </span>
                <p className="text-sm text-[#7A7067] mt-2">No notifications yet</p>
              </div>
            ) : (
              <div className="divide-y divide-[#2A2520]">
                {items.map((n) => (
                  <div
                    key={n.id}
                    className={`px-4 py-3 flex gap-2.5 ${n.isRead ? 'opacity-60' : ''}`}
                  >
                    {!n.isRead && (
                      <div
                        className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: accentColor }}
                      />
                    )}
                    <div className={n.isRead ? 'pl-4' : ''}>
                      <p className="text-xs font-semibold text-text-primary">{n.title}</p>
                      <p className="text-xs text-[#A89F91] mt-0.5 line-clamp-2">{n.message}</p>
                      <p className="text-[10px] text-[#7A7067] mt-1">{formatIST(n.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
