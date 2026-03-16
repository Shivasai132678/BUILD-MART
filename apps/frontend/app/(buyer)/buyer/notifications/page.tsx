'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatIST } from '@/lib/utils/date';
import { fetchNotifications, markAllNotificationsRead, markNotificationRead, type AppNotification } from '@/lib/notification-api';
import { getApiErrorMessage } from '@/lib/api';
import { toast } from 'sonner';

const TYPE_ICON: Record<string, string> = {
  RFQ_CREATED: 'request_quote',
  QUOTE_RECEIVED: 'sell',
  ORDER_CONFIRMED: 'inventory_2',
  STATUS_UPDATED: 'local_shipping',
  PAYMENT_INITIATED: 'credit_card',
  PAYMENT_SUCCESS: 'check_circle',
  PAYMENT_FAILED: 'cancel',
  ORDER_CANCELLED: 'do_not_disturb_on',
  VENDOR_APPROVED: 'verified',
  VENDOR_SUSPENDED: 'block',
};

function NotificationRow({ notification, onMarkRead }: { notification: AppNotification; onMarkRead: (id: string) => void }) {
  const icon = TYPE_ICON[notification.type] ?? 'notifications';
  return (
    <div
      className={`flex items-start gap-4 p-4 rounded-xl border transition-all ${
        notification.isRead
          ? 'border-[#2A2520] bg-[#1A1714]'
          : 'border-[#D97706]/30 bg-[#D97706]/5'
      }`}
    >
      <div className={`flex-shrink-0 h-9 w-9 rounded-full flex items-center justify-center ${notification.isRead ? 'bg-[#2A2520]' : 'bg-[#D97706]/20'}`}>
        <span className={`material-symbols-outlined text-[18px] ${notification.isRead ? 'text-[#7A7067]' : 'text-[#D97706]'}`}>{icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold ${notification.isRead ? 'text-[#A89F91]' : 'text-[#F5F0E8]'}`}>{notification.title}</p>
        <p className="mt-0.5 text-xs text-[#7A7067]">{notification.message}</p>
        <p className="mt-1 text-[11px] text-[#5A5047]">{formatIST(notification.createdAt)}</p>
      </div>
      {!notification.isRead && (
        <button
          type="button"
          onClick={() => onMarkRead(notification.id)}
          className="flex-shrink-0 text-[11px] font-medium text-[#D97706] hover:text-[#F59E0B] transition-colors whitespace-nowrap"
        >
          Mark read
        </button>
      )}
    </div>
  );
}

export default function BuyerNotificationsPage() {
  const queryClient = useQueryClient();

  const notificationsQuery = useQuery({
    queryKey: ['buyer-notifications'],
    queryFn: () => fetchNotifications(50, 0),
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['buyer-notifications'] });
      void queryClient.invalidateQueries({ queryKey: ['unread-count'] });
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Failed to mark as read.')),
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: () => {
      toast.success('All notifications marked as read.');
      void queryClient.invalidateQueries({ queryKey: ['buyer-notifications'] });
      void queryClient.invalidateQueries({ queryKey: ['unread-count'] });
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Failed to mark all as read.')),
  });

  const notifications = notificationsQuery.data?.items ?? [];
  const hasUnread = notifications.some((n) => !n.isRead);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#F5F0E8]">Notifications</h1>
          <p className="mt-1 text-sm text-[#A89F91]">Stay up to date on your RFQs, quotes, and orders.</p>
        </div>
        {hasUnread && (
          <button
            type="button"
            disabled={markAllReadMutation.isPending}
            onClick={() => markAllReadMutation.mutate()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium border border-[#2A2520] bg-[#1A1714] text-[#A89F91] hover:text-[#F5F0E8] hover:border-[#3A3027] transition-all disabled:opacity-60"
          >
            <span className="material-symbols-outlined text-[16px]">done_all</span>
            {markAllReadMutation.isPending ? 'Marking…' : 'Mark all read'}
          </button>
        )}
      </div>

      {notificationsQuery.isLoading && (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-[#1A1714] border border-[#2A2520] animate-pulse" />
          ))}
        </div>
      )}

      {notificationsQuery.isError && (
        <div className="bg-[#1A1714] border border-[#2A2520] rounded-2xl p-12 text-center">
          <span className="material-symbols-outlined text-4xl text-[#7A7067]">error</span>
          <p className="mt-3 font-semibold text-[#F5F0E8]">Failed to load notifications</p>
          <p className="mt-1 text-sm text-[#A89F91]">{getApiErrorMessage(notificationsQuery.error)}</p>
        </div>
      )}

      {!notificationsQuery.isLoading && !notificationsQuery.isError && notifications.length === 0 && (
        <div className="bg-[#1A1714] border border-dashed border-[#2A2520] rounded-2xl p-16 text-center">
          <span className="material-symbols-outlined text-5xl text-[#3A3027]">notifications_none</span>
          <p className="mt-4 font-semibold text-[#F5F0E8]">No notifications yet</p>
          <p className="mt-1 text-sm text-[#A89F91]">You&apos;ll be notified when quotes arrive, orders update, and more.</p>
        </div>
      )}

      {notifications.length > 0 && (
        <div className="space-y-2">
          {notifications.map((n) => (
            <NotificationRow
              key={n.id}
              notification={n}
              onMarkRead={(id) => markReadMutation.mutate(id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
