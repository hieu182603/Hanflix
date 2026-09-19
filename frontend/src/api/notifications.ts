import { apiFetch } from './client';

export interface ApiNotificationItem {
  _id: string;
  userId: string;
  type: 'streak' | 'lesson' | 'quiz' | 'vocab' | 'video_pipeline' | 'system';
  category: 'study' | 'system';
  title: {
    vi: string;
    en?: string;
    zh?: string;
  };
  message: {
    vi: string;
    en?: string;
    zh?: string;
  };
  isRead: boolean;
  actionUrl?: string;
  actionText?: {
    vi: string;
    en?: string;
    zh?: string;
  };
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationListResponse {
  items: ApiNotificationItem[];
  total: number;
  unreadCount: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface UnreadCountResponse {
  unreadCount: number;
}

export function fetchNotifications(params: {
  filter?: 'all' | 'unread' | 'study' | 'system';
  page?: number;
  limit?: number;
  signal?: AbortSignal;
} = {}): Promise<NotificationListResponse> {
  const { signal, ...rest } = params;
  const query = new URLSearchParams();
  Object.entries(rest).forEach(([key, value]) => {
    // `rest` keys are well-typed (filter enum / number); undefined means "skip",
    // anything else is meaningful and should be sent.
    if (value !== undefined) query.set(key, String(value));
  });
  return apiFetch<NotificationListResponse>(`/notifications?${query}`, { signal });
}

export function fetchUnreadCount(options: { signal?: AbortSignal } = {}): Promise<UnreadCountResponse> {
  return apiFetch<UnreadCountResponse>('/notifications/unread-count', options);
}

export function markAllAsRead(): Promise<{ updatedCount: number }> {
  return apiFetch<{ updatedCount: number }>('/notifications/mark-all-read', {
    method: 'PATCH',
  });
}

export function markNotificationAsRead(id: string, isRead = true): Promise<ApiNotificationItem> {
  return apiFetch<ApiNotificationItem>(`/notifications/${encodeURIComponent(id)}/read`, {
    method: 'PATCH',
    body: JSON.stringify({ isRead }),
  });
}

export function deleteNotification(id: string): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/notifications/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}
