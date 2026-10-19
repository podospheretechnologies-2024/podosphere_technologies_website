import useSWR from 'swr';
import { apiFetch, fetcher } from '@/shared/lib/fetcher';
import type { SocialNotificationType } from '../config/notifications';

export const NOTIFICATIONS_API_ROUTE = '/api/social/notifications';

export type NotificationItem = {
  id: string;
  type: SocialNotificationType | string;
  content: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

export type NotificationsResponse = {
  items: NotificationItem[];
  unreadCount: number;
};

export function useNotifications() {
  return useSWR<NotificationsResponse>(NOTIFICATIONS_API_ROUTE, fetcher, {
    refreshInterval: 60_000,
    revalidateOnFocus: true,
  });
}

export async function markNotificationRead(id: string): Promise<NotificationItem> {
  return apiFetch<NotificationItem>(`${NOTIFICATIONS_API_ROUTE}/${id}`, { method: 'PATCH' });
}

export async function markAllNotificationsRead(): Promise<{ updated: number }> {
  return apiFetch<{ updated: number }>(NOTIFICATIONS_API_ROUTE, { method: 'PATCH' });
}
