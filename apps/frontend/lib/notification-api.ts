import { api, unwrapApiData } from '@/lib/api';
import type { PaginatedResponse } from '@/lib/buyer-api';

export type NotificationMetadata = {
  orderId?: string;
  rfqId?: string;
  quoteId?: string;
  vendorProfileId?: string;
  status?: string;
  [key: string]: unknown;
};

export type AppNotification = {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  metadata?: NotificationMetadata | null;
  createdAt: string;
};

export async function fetchNotifications(limit = 20, offset = 0) {
  const response = await api.get('/api/v1/notifications', {
    params: { limit, offset },
  });
  return unwrapApiData<PaginatedResponse<AppNotification>>(response.data);
}

export async function getUnreadCount() {
  const response = await api.get('/api/v1/notifications/unread-count');
  return unwrapApiData<{ count: number }>(response.data);
}

export async function markNotificationRead(id: string) {
  const response = await api.patch(`/api/v1/notifications/${id}/read`);
  return unwrapApiData<AppNotification>(response.data);
}

export async function markAllNotificationsRead() {
  const response = await api.patch('/api/v1/notifications/read-all');
  return unwrapApiData<{ count: number }>(response.data);
}
