import useSWR from 'swr';
import { fetcher } from '@/shared/lib/fetcher';
import type { PostListFilter } from '../config/posts';
import type { PostGroup, PostListPage } from '../types/post';

export const POSTS_API_ROUTE = '/api/social/posts';

export function usePostsList(page: number, state: PostListFilter) {
  const params = new URLSearchParams({ page: String(page), state });
  return useSWR<PostListPage>(`${POSTS_API_ROUTE}?${params}`, fetcher, {
    keepPreviousData: true,
  });
}

export function usePostGroup(group: string | null) {
  return useSWR<PostGroup>(group ? `${POSTS_API_ROUTE}/${group}` : null, fetcher, {
    revalidateOnFocus: false,
  });
}
