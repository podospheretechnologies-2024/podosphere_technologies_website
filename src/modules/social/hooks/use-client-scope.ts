'use client';

import { createContext, useContext } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/shared/lib/fetcher';

export const CLIENT_SCOPE_API_ROUTE = '/api/social/client-scope';

export interface ClientSwitcherItem {
  id: string;
  name: string;
}

export interface ClientScopeState {
  selectedClientId: string | null;
  clients: ClientSwitcherItem[];
}

export type ClientScopeContextValue = {
  selectedClientId: string | null;
  clients: ClientSwitcherItem[];
  /** Stable SWR cache segment: client id or `'all'`. */
  scopeKey: string;
  setSelectedClientId: (clientId: string | null) => Promise<void>;
  isLoading: boolean;
};

export const ClientScopeContext = createContext<ClientScopeContextValue | null>(null);

export function useClientScope(): ClientScopeContextValue {
  const ctx = useContext(ClientScopeContext);
  if (!ctx) {
    throw new Error('useClientScope must be used inside ClientScopeProvider');
  }
  return ctx;
}

/** Safe for hooks that may run outside the provider during tests — falls back to `'all'`. */
export function useClientScopeKey(): string {
  const ctx = useContext(ClientScopeContext);
  return ctx?.scopeKey ?? 'all';
}

export function useClientScopeState(fallback?: ClientScopeState | null) {
  return useSWR<ClientScopeState>(CLIENT_SCOPE_API_ROUTE, fetcher, {
    fallbackData: fallback ?? undefined,
    revalidateOnFocus: false,
  });
}
