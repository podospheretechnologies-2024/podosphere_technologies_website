import { apiFetch } from '@/shared/lib/fetcher';
import { AUTOPOSTS_API_ROUTE, WEBHOOKS_API_ROUTE } from '../hooks/use-automation';
import type {
  AutopostItem,
  AutopostRunResult,
  SaveAutopostInput,
  SaveWebhookInput,
  WebhookItem,
  WebhookTestResult,
} from '../types/automation';

function sendJson<T>(url: string, method: 'POST' | 'PUT', body: unknown): Promise<T> {
  return apiFetch<T>(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** Creates a webhook, or updates it when `id` is given. */
export function saveWebhook(input: SaveWebhookInput, id?: string): Promise<WebhookItem> {
  return id
    ? sendJson(`${WEBHOOKS_API_ROUTE}/${id}`, 'PUT', input)
    : sendJson(WEBHOOKS_API_ROUTE, 'POST', input);
}

export function deleteWebhook(id: string): Promise<void> {
  return apiFetch<void>(`${WEBHOOKS_API_ROUTE}/${id}`, { method: 'DELETE' });
}

export function testWebhook(id: string): Promise<WebhookTestResult> {
  return apiFetch<WebhookTestResult>(`${WEBHOOKS_API_ROUTE}/${id}/test`, { method: 'POST' });
}

/** Creates an RSS autopost, or updates it when `id` is given. */
export function saveAutopost(input: SaveAutopostInput, id?: string): Promise<AutopostItem> {
  return id
    ? sendJson(`${AUTOPOSTS_API_ROUTE}/${id}`, 'PUT', input)
    : sendJson(AUTOPOSTS_API_ROUTE, 'POST', input);
}

export function deleteAutopost(id: string): Promise<void> {
  return apiFetch<void>(`${AUTOPOSTS_API_ROUTE}/${id}`, { method: 'DELETE' });
}

export function runAutopost(id: string): Promise<AutopostRunResult> {
  return apiFetch<AutopostRunResult>(`${AUTOPOSTS_API_ROUTE}/${id}/run`, { method: 'POST' });
}
