'use client';

import useSWR from 'swr';
import { apiFetch, fetcher } from '@/shared/lib/fetcher';
import type {
  OpsClientStatus,
  OpsServiceCategory,
} from '@/modules/social/server/ops/ops.constants';

export const OPS_API = '/api/social/ops';

export type OpsService = {
  id: string;
  category: OpsServiceCategory;
  subtype: string;
  groupLabel: string | null;
};

export type OpsClient = {
  id: string;
  name: string;
  status: OpsClientStatus;
  engagementType: string | null;
  monthlyFee: number | null;
  retainerStart: string | null;
  retainerMonths: number | null;
  teamNames: string | null;
  notes: string | null;
  workStatus: string | null;
  escalation: string | null;
  category: string | null;
  socialCustomerId: string | null;
  services: OpsService[];
  createdAt: string;
  updatedAt: string;
};

export type OpsPayment = {
  id: string;
  clientId: string;
  clientName: string | null;
  amount: number | null;
  description: string | null;
  dueDate: string | null;
  paidAt: string | null;
  monthKey: string;
  dueInDays: number | null;
  bucket: 'overdue' | 'next_7' | 'later' | 'no_due_date' | 'paid';
};

export type OpsDashboard = {
  monthKey: string;
  kpis: {
    activeClients: number;
    totalClients: number;
    monthlyRetainer: number;
    retainerClientCount: number;
    toCollect: number;
    toCollectCount: number;
    collected: number;
    collectedCount: number;
    overdueAmount: number;
    overdueCount: number;
    renewalsDue: number;
    openEscalations: number;
    avgCollectionDelayDays: number | null;
  };
  statusCounts: Record<OpsClientStatus, number>;
  collectionsDue: OpsPayment[];
  renewals: Array<{ client: OpsClient; endsOn: string; daysLeft: number | null }>;
  serviceSummary: Array<{
    category: OpsServiceCategory;
    totalClients: number;
    subtypes: Array<{ groupLabel: string | null; subtype: string; count: number }>;
  }>;
};

export type OpsServicesView = {
  monthKey: string;
  category: OpsServiceCategory;
  kpis: {
    totalClients: number;
    activeClients: number;
    monthlyFee: number;
    feeEnteredCount: number;
    escalations: number;
    workDelayed: number;
  };
  subtypes: Array<{ subtype: string; count: number }>;
  clients: OpsClient[];
};

export function formatInr(amount: number | null | undefined, compact = false): string {
  if (amount == null) return '—';
  if (compact && amount >= 100_000) {
    const lakhs = amount / 100_000;
    const text = lakhs >= 10 ? lakhs.toFixed(0) : lakhs.toFixed(1).replace(/\.0$/, '');
    return `₹${text}L`;
  }
  return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

export function useOpsClients() {
  return useSWR<OpsClient[]>(`${OPS_API}/clients`, fetcher);
}

export function useOpsPayments(monthKey: string) {
  return useSWR<OpsPayment[]>(`${OPS_API}/payments?monthKey=${monthKey}`, fetcher);
}

export function useOpsDashboard(monthKey: string) {
  return useSWR<OpsDashboard>(`${OPS_API}/dashboard?monthKey=${monthKey}`, fetcher);
}

export function useOpsServices(category: OpsServiceCategory, monthKey: string) {
  return useSWR<OpsServicesView>(
    `${OPS_API}/services?category=${category}&monthKey=${monthKey}`,
    fetcher
  );
}

export async function opsCall<T>(
  path: string,
  method: 'POST' | 'PATCH' | 'DELETE',
  body?: unknown
): Promise<T> {
  return apiFetch<T>(`${OPS_API}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}
