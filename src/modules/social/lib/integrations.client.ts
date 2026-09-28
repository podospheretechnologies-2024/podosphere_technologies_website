import { apiFetch } from '@/shared/lib/fetcher';
import { INTEGRATIONS_API_ROUTE } from '../hooks/use-channels';
import type { ConnectUrlResponse } from '../types/integration';

// Sends the browser to the provider's consent screen. Pass the channel id to
// reconnect an existing channel instead of adding a new one.
export async function startChannelConnect(identifier: string, refreshId?: string): Promise<void> {
  const params = refreshId ? `?${new URLSearchParams({ refresh: refreshId })}` : '';
  const { url } = await apiFetch<ConnectUrlResponse>(
    `${INTEGRATIONS_API_ROUTE}/connect/${identifier}${params}`
  );
  window.location.assign(url);
}

export function setChannelDisabled(id: string, disabled: boolean): Promise<void> {
  return apiFetch<void>(`${INTEGRATIONS_API_ROUTE}/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ disabled }),
  });
}

export function deleteChannel(id: string): Promise<void> {
  return apiFetch<void>(`${INTEGRATIONS_API_ROUTE}/${id}`, { method: 'DELETE' });
}
