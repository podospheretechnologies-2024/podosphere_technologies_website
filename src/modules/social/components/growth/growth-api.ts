'use client';

import useSWR, { type SWRResponse } from 'swr';
import { apiFetch, fetcher } from '@/shared/lib/fetcher';
import { useClientScopeKey } from '../../hooks/use-client-scope';

export const GROWTH_API = '/api/social/growth';

/** SWR keyed by the client switcher so data never leaks across clients. */
export function useGrowth<T>(path: string | null): SWRResponse<T, Error> {
  const scopeKey = useClientScopeKey();
  return useSWR<T, Error>(path ? [`${GROWTH_API}${path}`, scopeKey] : null, ([url]: [string, string]) => fetcher<T>(url), {
    revalidateOnFocus: false,
  });
}

export async function growthCall<T = unknown>(path: string, method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', body?: unknown): Promise<T> {
  return apiFetch<T>(`${GROWTH_API}${path}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

// ---------- shared types (mirror the server DTOs) ----------

export interface ShopifyStore {
  connected: boolean;
  shopDomain: string | null;
  shopName: string | null;
  primaryUrl: string | null;
  currency: string | null;
  timeZone: string | null;
  authMode: string | null;
  scopes: string[];
  missingScopes: string[];
  status: string | null;
  lastError: string | null;
  lastSyncedAt: string | null;
  trafficAvailable: boolean | null;
  trafficError: string | null;
}

export interface GrowthSettings {
  targetRoas: number;
  targetCpl: number | null;
  dailyBudget: number | null;
  budgetCap: number | null;
  blogsPerMonth: number;
  reportEveryDays: number;
  contentSheetUrl: string | null;
  brandContext: string | null;
  insightsEnabled: boolean;
  lastInsightsAt: string | null;
}

export interface DailyRow {
  date: string;
  orders: number | null;
  sales: number | null;
  sessions: number | null;
  atc: number | null;
  spend: number | null;
  metaPurchases: number | null;
  metaRevenue: number | null;
  metaLeads: number | null;
}

export interface CampaignRow {
  id: string;
  name: string;
  status: string;
  objective: string | null;
  spend: number;
  purchases: number;
  revenue: number;
  roas: number | null;
  costPerPurchase: number | null;
  ctr: number | null;
  atc: number;
}

export interface Overview {
  client: { id: string; name: string };
  range: { from: string; to: string; label: string };
  store: ShopifyStore;
  settings: GrowthSettings;
  hasAds: boolean;
  hasMetaAds: boolean;
  hasGoogleAds: boolean;
  googleError: string | null;
  totals: {
    sales: number | null;
    orders: number | null;
    sessions: number | null;
    atc: number | null;
    spend: number | null;
    metaSpend: number | null;
    googleSpend: number | null;
    metaPurchases: number | null;
    metaRevenue: number | null;
    metaLeads: number | null;
    googleConversions: number | null;
    /** Shopify ROAS when store linked, else Meta ROAS — works for every client with ads. */
    roas: number | null;
    shopifyRoas: number | null;
    metaRoas: number | null;
    aov: number | null;
  };
  days: DailyRow[];
  campaigns: CampaignRow[];
  googleCampaigns: CampaignRow[];
  counts: {
    openTasks: number;
    reviewTasks: number;
    pendingAds: number;
    approvedAds: number;
    draftBlogs: number;
    approvedBlogs: number;
    reportDue: boolean;
    nextReportDue: string | null;
  };
  canReview: boolean;
}

export interface Task {
  id: string;
  title: string;
  detail: string | null;
  area: string;
  priority: string;
  status: string;
  dueDate: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  link: string | null;
  source: string;
  doneNote: string | null;
  doneAt: string | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export interface TasksPayload {
  tasks: Task[];
  people: { id: string; name: string }[];
  canReview: boolean;
}

export interface Insight {
  id: string;
  date: string;
  severity: string;
  title: string;
  body: string;
}

export const TASK_AREAS = ['ads', 'website', 'content', 'smm', 'seo', 'design', 'video', 'other'] as const;

// ---------- formatting ----------

export function money(value: number | null | undefined, currency = 'INR'): string {
  if (value == null) return '–';
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
  } catch {
    return `${currency} ${Math.round(value).toLocaleString('en-IN')}`;
  }
}

export function count(value: number | null | undefined): string {
  return value == null ? '–' : Math.round(value).toLocaleString('en-IN');
}

export function pct(part: number | null | undefined, whole: number | null | undefined): string {
  return part == null || !whole ? '–' : `${((part / whole) * 100).toFixed(1)}%`;
}

export function times(value: number | null | undefined): string {
  return value == null ? '–' : `${value.toFixed(value >= 10 ? 1 : 2)}x`;
}

export function errorText(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong';
}

// ---------- Google Analytics 4 ----------

export interface Ga4Property {
  propertyId: string;
  displayName: string;
  accountName: string | null;
  currency: string | null;
  timeZone: string | null;
  status: string;
  lastError: string | null;
  lastSyncedAt: string | null;
}

export interface Ga4Status {
  configured: boolean;
  connected: boolean;
  googleEmail: string | null;
  connectionError: string | null;
  canConnect: boolean;
  property: Ga4Property | null;
  available: { propertyId: string; displayName: string; accountName: string | null }[];
  redirectUri: string;
}

export interface Ga4Totals {
  sessions: number;
  totalUsers: number;
  newUsers: number;
  engagedSessions: number;
  addToCarts: number;
  checkouts: number;
  purchases: number;
  revenue: number;
  keyEvents: number;
}

export interface Ga4Row {
  name: string;
  sessions: number;
  users: number;
  atc: number;
  purchases: number;
  revenue: number;
}

export interface Ga4Website {
  property: Ga4Property | null;
  snapshot: {
    periodStart: string;
    periodEnd: string;
    totals: Ga4Totals;
    channels: Ga4Row[];
    sources: Ga4Row[];
    landing: Ga4Row[];
    devices: Ga4Row[];
    updatedAt: string;
  } | null;
}

export interface ContentSheetRow {
  date: string;
  sheetName: string;
  rowIndex: number;
  content: string;
  platform: string | null;
  format: string | null;
  status: string | null;
  inCalendar: boolean;
}

export interface ContentSheet {
  configured: boolean;
  connected: boolean;
  googleEmail: string | null;
  canConnect: boolean;
  link: { spreadsheetId: string; url: string; tab: string | null } | null;
  sheet: { name: string; url: string; tabs: string[]; syncedAt: string } | null;
  error: string | null;
  rows: ContentSheetRow[];
  undated: number;
  from: string;
  to: string;
}

export interface ContentSheetOption {
  spreadsheetId: string;
  name: string;
  url: string;
  sheetNames: string[];
  rowCount: number;
}
