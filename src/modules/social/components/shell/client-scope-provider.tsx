'use client';

import { useCallback, useState, type ReactNode } from 'react';
import { useSWRConfig } from 'swr';
import { apiFetch } from '@/shared/lib/fetcher';
import {
  CLIENT_SCOPE_API_ROUTE,
  ClientScopeContext,
  useClientScopeState,
  type ClientScopeState,
} from '../../hooks/use-client-scope';

/** Social keys that belong to the new scope: scope-less string keys, and array keys carrying that scope. */
function isKeyForScope(scopeKey: string) {
  return (key: unknown): boolean => {
    if (typeof key === 'string') return key.startsWith('/api/social');
    if (Array.isArray(key) && typeof key[0] === 'string') {
      return key[0].startsWith('/api/social') && key.includes(scopeKey);
    }
    return false;
  };
}

export function ClientScopeProvider({
  children,
  initial,
}: {
  children: ReactNode;
  initial?: ClientScopeState | null;
}) {
  const { mutate: globalMutate } = useSWRConfig();
  const { data, isLoading, mutate } = useClientScopeState(initial);

  const [pending, setPending] = useState<{ clientId: string | null } | null>(null);

  const confirmedClientId = data?.selectedClientId ?? initial?.selectedClientId ?? null;
  const clients = data?.clients ?? initial?.clients ?? [];
  // Data keys follow the confirmed scope (the server cookie is written by the PUT); the picker
  // label follows the optimistic one so the click feels instant.
  const scopeKey = confirmedClientId ?? 'all';
  const selectedClientId = pending ? pending.clientId : confirmedClientId;
  const switchingToName = pending
    ? pending.clientId === null
      ? 'All clients'
      : pending.clientId === 'unassigned'
        ? 'Unassigned'
        : (clients.find((client) => client.id === pending.clientId)?.name ?? 'client')
    : null;

  const setSelectedClientId = useCallback(
    async (clientId: string | null) => {
      setPending({ clientId });
      try {
        const next = await apiFetch<ClientScopeState>(CLIENT_SCOPE_API_ROUTE, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId }),
        });
        await mutate(next, { revalidate: false });
        // Only the new scope's keys; other scopes' caches are left alone.
        void globalMutate(isKeyForScope(next.selectedClientId ?? 'all'));
      } finally {
        setPending(null);
      }
    },
    [globalMutate, mutate]
  );

  return (
    <ClientScopeContext.Provider
      value={{
        selectedClientId,
        clients,
        scopeKey,
        setSelectedClientId,
        isLoading,
        isSwitching: pending !== null,
        switchingToName,
      }}
    >
      {pending && (
        <div
          role="status"
          className="bg-primary text-primary-foreground fixed inset-x-0 top-0 z-50 px-3 py-1 text-center text-xs font-medium"
        >
          Switching to {switchingToName}…
        </div>
      )}
      {children}
    </ClientScopeContext.Provider>
  );
}
