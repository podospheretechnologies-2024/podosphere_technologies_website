import useSWR from 'swr';
import { fetcher } from '@/shared/lib/fetcher';
import type { HashtagGroupItem, SignatureItem, TagItem, TemplateItem } from '../types/settings';
import { useClientScopeKey } from './use-client-scope';

export const SIGNATURES_API_ROUTE = '/api/social/signatures';
export const TAGS_API_ROUTE = '/api/social/tags';
export const TEMPLATES_API_ROUTE = '/api/social/sets';
export const HASHTAG_GROUPS_API_ROUTE = '/api/social/hashtag-groups';

export function useSignatures() {
  const scopeKey = useClientScopeKey();
  return useSWR<SignatureItem[]>([SIGNATURES_API_ROUTE, scopeKey], ([url]) => fetcher(url));
}

export function useTags() {
  const scopeKey = useClientScopeKey();
  return useSWR<TagItem[]>([TAGS_API_ROUTE, scopeKey], ([url]) => fetcher(url));
}

export function useTemplates() {
  const scopeKey = useClientScopeKey();
  return useSWR<TemplateItem[]>([TEMPLATES_API_ROUTE, scopeKey], ([url]) => fetcher(url));
}

export function useHashtagGroups() {
  const scopeKey = useClientScopeKey();
  return useSWR<HashtagGroupItem[]>([HASHTAG_GROUPS_API_ROUTE, scopeKey], ([url]) => fetcher(url));
}
