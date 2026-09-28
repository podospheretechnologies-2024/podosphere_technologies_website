import dayjs from 'dayjs';
import { mutate } from 'swr';
import { apiFetch } from '@/shared/lib/fetcher';
import { POSTS_API_ROUTE } from '../hooks/use-posts';
import type { SavePostInput } from '../types/post';

const DATETIME_LOCAL_FORMAT = 'YYYY-MM-DDTHH:mm';

export function savePost(input: SavePostInput, group?: string): Promise<{ group: string }> {
  return apiFetch<{ group: string }>(group ? `${POSTS_API_ROUTE}/${group}` : POSTS_API_ROUTE, {
    method: group ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function deletePostGroup(group: string): Promise<void> {
  return apiFetch<void>(`${POSTS_API_ROUTE}/${group}`, { method: 'DELETE' });
}

export function reschedulePost(group: string, date: Date): Promise<void> {
  return apiFetch<void>(`${POSTS_API_ROUTE}/${group}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date: date.toISOString() }),
  });
}

/** Refreshes every cached posts request (list, calendar ranges, groups). */
export function revalidatePosts(): Promise<unknown> {
  return mutate((key) => typeof key === 'string' && key.startsWith(POSTS_API_ROUTE));
}

/** Value for an <input type="datetime-local"> in the user's timezone. */
export function toDateTimeLocal(date: string | Date): string {
  return dayjs(date).format(DATETIME_LOCAL_FORMAT);
}

/** Next round hour, a sensible default slot for a new post. */
export function nextPostSlot(): string {
  return toDateTimeLocal(dayjs().add(1, 'hour').startOf('hour').toDate());
}

export function formatPostDate(date: string): string {
  return dayjs(date).format('ddd, D MMM YYYY · HH:mm');
}
