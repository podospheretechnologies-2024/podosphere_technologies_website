import useSWR from 'swr';
import { fetcher } from '@/shared/lib/fetcher';
import {
  ORDER_FLOWS_API,
  type OrderFlowActivityQuery,
  type OrderFlowResultsQuery,
} from '../lib/order-flow.client';
import type {
  OrderFlowActivityResponse,
  OrderFlowListResponse,
  OrderFlowResultsResponse,
} from '../types/order-flow';
import { useClientScopeKey } from './use-client-scope';

/** PS-22: order flows belong to one client's store; never fetch under All clients / Unassigned. */
export function isSingleClientScopeKey(scopeKey: string): boolean {
  return Boolean(scopeKey) && scopeKey !== 'all' && scopeKey !== 'unassigned';
}

function withQuery(path: string, params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const qs = search.toString();
  return qs ? `${path}?${qs}` : path;
}

export function useOrderFlows() {
  const scopeKey = useClientScopeKey();
  return useSWR<OrderFlowListResponse>(
    isSingleClientScopeKey(scopeKey) ? [ORDER_FLOWS_API, scopeKey] : null,
    ([url]: [string, string]) => fetcher<OrderFlowListResponse>(url),
    { revalidateOnFocus: false }
  );
}

export function useOrderFlowActivity(query: OrderFlowActivityQuery) {
  const scopeKey = useClientScopeKey();
  const path = withQuery(`${ORDER_FLOWS_API}/activity`, {
    flowKey: query.flowKey || undefined,
    status: query.status || undefined,
    from: query.from,
    to: query.to,
  });
  return useSWR<OrderFlowActivityResponse>(
    isSingleClientScopeKey(scopeKey) ? [path, scopeKey] : null,
    ([url]: [string, string]) => fetcher(url),
    { revalidateOnFocus: false }
  );
}

export function useOrderFlowResults(query: OrderFlowResultsQuery) {
  const scopeKey = useClientScopeKey();
  const path = withQuery(`${ORDER_FLOWS_API}/results`, {
    from: query.from,
    to: query.to,
  });
  return useSWR<OrderFlowResultsResponse>(
    isSingleClientScopeKey(scopeKey) ? [path, scopeKey] : null,
    ([url]: [string, string]) => fetcher(url),
    { revalidateOnFocus: false }
  );
}
