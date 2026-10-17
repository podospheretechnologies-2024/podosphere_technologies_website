'use client';

import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useSWRConfig } from 'swr';
import { apiFetch } from '@/shared/lib/fetcher';
import {
  CLIENT_SCOPE_API_ROUTE,
  ClientScopeContext,
  useClientScopeState,
  type ClientScopeState,
} from '../../hooks/use-client-scope';

function isSocialSwrKey(key: unknown): boolean {
  if (typeof key === 'string') return key.startsWith('/api/social');
  if (Array.isArray(key) && typeof key[0] === 'string') return key[0].startsWith('/api/social');
  return false;
}

export function ClientScopeProvider({
  children,
  initial,
}: {
  children: ReactNode;
  initial?: ClientScopeState | null;
}) {
  const router = useRouter();
  const { mutate: globalMutate } = useSWRConfig();
  const { data, isLoading, mutate } = useClientScopeState(initial);

  const selectedClientId = data?.selectedClientId ?? initial?.selectedClientId ?? null;
  const clients = data?.clients ?? initial?.clients ?? [];
  const scopeKey = selectedClientId ?? 'all';

  async function setSelectedClientId(clientId: string | null) {
    const next = await apiFetch<ClientScopeState>(CLIENT_SCOPE_API_ROUTE, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId }),
    });
    await mutate(next, { revalidate: false });
    await globalMutate(isSocialSwrKey, undefined, { revalidate: true });
    router.refresh();
  }

  return (
    <ClientScopeContext.Provider
      value={{
        selectedClientId,
        clients,
        scopeKey,
        setSelectedClientId,
        isLoading,
      }}
    >
      {children}
    </ClientScopeContext.Provider>
  );
}
