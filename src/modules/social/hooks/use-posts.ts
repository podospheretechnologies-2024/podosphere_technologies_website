import type { Dayjs } from 'dayjs';
import useSWR from 'swr';
import { fetcher } from '@/shared/lib/fetcher';
import type { PostListFilter } from '../config/posts';
import type { PostGroup, PostListItem, PostListPage } from '../types/post';
import { useClientScopeKey } from './use-client-scope';

export const POSTS_API_ROUTE = '/api/social/posts';

export function usePostsList(page: number, state: PostListFilter) {
  const scopeKey = useClientScopeKey();
  const params = new URLSearchParams({ page: String(page), state });
  const url = `${POSTS_API_ROUTE}?${params}`;
  return useSWR<PostListPage>([url, scopeKey], ([path]) => fetcher(path), {
    keepPreviousData: true,
  });
}

export function useCalendarPosts(range: { start: Dayjs; end: Dayjs } | null) {
  const scopeKey = useClientScopeKey();
  const params = range
    ? new URLSearchParams({
        startDate: range.start.toISOString(),
        endDate: range.end.toISOString(),
      })
    : null;
  const url = params ? `${POSTS_API_ROUTE}/calendar?${params}` : null;
  return useSWR<PostListItem[]>(url ? [url, scopeKey] : null, ([path]) => fetcher(path), {
    keepPreviousData: true,
  });
}

export function usePostGroup(group: string | null) {
  const scopeKey = useClientScopeKey();
  const url = group ? `${POSTS_API_ROUTE}/${group}` : null;
  return useSWR<PostGroup>(url ? [url, scopeKey] : null, ([path]) => fetcher(path), {
    revalidateOnFocus: false,
  });
}
