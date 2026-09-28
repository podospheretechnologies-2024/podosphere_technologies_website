import { apiFetch } from '@/shared/lib/fetcher';
import { SIGNATURES_API_ROUTE, TAGS_API_ROUTE, TEMPLATES_API_ROUTE } from '../hooks/use-settings';
import type {
  CreateTemplateInput,
  SaveSignatureInput,
  SaveTagInput,
  SignatureItem,
  TagItem,
  TemplateItem,
} from '../types/settings';

function sendJson<T>(url: string, method: 'POST' | 'PUT', body: unknown): Promise<T> {
  return apiFetch<T>(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** Creates a signature, or updates it when `id` is given. */
export function saveSignature(input: SaveSignatureInput, id?: string): Promise<SignatureItem> {
  return id
    ? sendJson(`${SIGNATURES_API_ROUTE}/${id}`, 'PUT', input)
    : sendJson(SIGNATURES_API_ROUTE, 'POST', input);
}

export function deleteSignature(id: string): Promise<void> {
  return apiFetch<void>(`${SIGNATURES_API_ROUTE}/${id}`, { method: 'DELETE' });
}

/** Creates a tag, or updates it when `id` is given. */
export function saveTag(input: SaveTagInput, id?: string): Promise<TagItem> {
  return id
    ? sendJson(`${TAGS_API_ROUTE}/${id}`, 'PUT', input)
    : sendJson(TAGS_API_ROUTE, 'POST', input);
}

export function deleteTag(id: string): Promise<void> {
  return apiFetch<void>(`${TAGS_API_ROUTE}/${id}`, { method: 'DELETE' });
}

export function createTemplate(input: CreateTemplateInput): Promise<TemplateItem> {
  return sendJson(TEMPLATES_API_ROUTE, 'POST', input);
}

export function renameTemplate(id: string, name: string): Promise<TemplateItem> {
  return sendJson(`${TEMPLATES_API_ROUTE}/${id}`, 'PUT', { name });
}

export function deleteTemplate(id: string): Promise<void> {
  return apiFetch<void>(`${TEMPLATES_API_ROUTE}/${id}`, { method: 'DELETE' });
}
