import { apiFetch } from '@/shared/lib/fetcher';
import type { OrderFlowKey } from '../config/order-flows';
import type {
  OrderFlowActivityResponse,
  OrderFlowDetail,
  OrderFlowListResponse,
  OrderFlowMessageStatus,
  OrderFlowOnlyIf,
  OrderFlowResultsResponse,
  OrderFlowStopIf,
  OrderFlowTestSendResult,
  OrderFlowVariableMap,
} from '../types/order-flow';

export const ORDER_FLOWS_API = '/api/social/whatsapp/order-flows';

export type OrderFlowPatchInput = {
  enabled?: boolean;
  templateName?: string | null;
  templateLanguage?: string | null;
  delayValue?: number | null;
  delayUnit?: OrderFlowDetail['delayUnit'];
  onlyIf?: OrderFlowOnlyIf;
  variableMap?: OrderFlowVariableMap;
  stopIf?: OrderFlowStopIf;
};

export type OrderFlowActivityQuery = {
  flowKey?: OrderFlowKey | '';
  status?: OrderFlowMessageStatus | '';
  from?: string;
  to?: string;
};

export type OrderFlowResultsQuery = {
  from?: string;
  to?: string;
};

function withQuery(path: string, params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const qs = search.toString();
  return qs ? `${path}?${qs}` : path;
}

/** Date input (YYYY-MM-DD) → start/end of day ISO for API zod datetime. */
export function dayStartIso(date: string): string {
  return new Date(`${date}T00:00:00.000`).toISOString();
}

export function dayEndIso(date: string): string {
  return new Date(`${date}T23:59:59.999`).toISOString();
}

export function fetchOrderFlows(): Promise<OrderFlowListResponse> {
  return apiFetch<OrderFlowListResponse>(ORDER_FLOWS_API);
}

export function fetchOrderFlow(flowKey: OrderFlowKey): Promise<OrderFlowDetail> {
  return apiFetch<OrderFlowDetail>(`${ORDER_FLOWS_API}/${flowKey}`);
}

export function patchOrderFlow(
  flowKey: OrderFlowKey,
  body: OrderFlowPatchInput
): Promise<OrderFlowDetail> {
  return apiFetch<OrderFlowDetail>(`${ORDER_FLOWS_API}/${flowKey}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function fetchOrderFlowActivity(
  query: OrderFlowActivityQuery = {}
): Promise<OrderFlowActivityResponse> {
  return apiFetch(
    withQuery(`${ORDER_FLOWS_API}/activity`, {
      flowKey: query.flowKey || undefined,
      status: query.status || undefined,
      from: query.from,
      to: query.to,
    })
  );
}

export function fetchOrderFlowResults(
  query: OrderFlowResultsQuery = {}
): Promise<OrderFlowResultsResponse> {
  return apiFetch(
    withQuery(`${ORDER_FLOWS_API}/results`, {
      from: query.from,
      to: query.to,
    })
  );
}

export function testOrderFlow(
  flowKey: OrderFlowKey,
  to: string
): Promise<OrderFlowTestSendResult> {
  return apiFetch(`${ORDER_FLOWS_API}/${flowKey}/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to }),
  });
}
