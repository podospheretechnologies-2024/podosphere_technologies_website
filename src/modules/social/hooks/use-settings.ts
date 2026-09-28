import useSWR from 'swr';
import { fetcher } from '@/shared/lib/fetcher';
import type { SignatureItem, TagItem, TemplateItem } from '../types/settings';

export const SIGNATURES_API_ROUTE = '/api/social/signatures';
export const TAGS_API_ROUTE = '/api/social/tags';
export const TEMPLATES_API_ROUTE = '/api/social/sets';

export function useSignatures() {
  return useSWR<SignatureItem[]>(SIGNATURES_API_ROUTE, fetcher);
}

export function useTags() {
  return useSWR<TagItem[]>(TAGS_API_ROUTE, fetcher);
}

export function useTemplates() {
  return useSWR<TemplateItem[]>(TEMPLATES_API_ROUTE, fetcher);
}
