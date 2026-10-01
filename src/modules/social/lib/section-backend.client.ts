import { apiFetch } from '@/shared/lib/fetcher';
import {
  ADS_DEFAULT_DATE_PRESET,
  getSectionBackendEndpoints,
  type SectionBackendEndpoint,
} from '../config/section-backend';
import { POST_LIST_FILTER_VALUES } from '../config/posts';

export interface SectionBackendResult {
  label: string;
  url: string;
  status: 'ok' | 'error';
  data?: unknown;
  error?: string;
}

export interface SectionBackendLoadResult {
  endpoints: SectionBackendResult[];
  /** Every endpoint response merged into one object for the section. */
  complete: Record<string, unknown>;
}

const MAX_NESTED = 40;
const MAX_PAGES = 25;

async function fetchOne(endpoint: SectionBackendEndpoint): Promise<SectionBackendResult> {
  try {
    const data = await apiFetch<unknown>(endpoint.url);
    return { label: endpoint.label, url: endpoint.url, status: 'ok', data };
  } catch (error) {
    return {
      label: endpoint.label,
      url: endpoint.url,
      status: 'error',
      error: error instanceof Error ? error.message : 'Request failed',
    };
  }
}

function slug(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

async function fetchAllMediaPages(endpoints: SectionBackendResult[]) {
  const first = endpoints.find((entry) => entry.url.startsWith('/api/social/media?'));
  if (!first || first.status !== 'ok' || !first.data || typeof first.data !== 'object') {
    return;
  }

  const page1 = first.data as { pages?: number; items?: unknown[] };
  const pages = Math.min(MAX_PAGES, Math.max(1, Number(page1.pages) || 1));
  const allItems = [...(page1.items ?? [])];

  for (let page = 2; page <= pages; page += 1) {
    const url = `/api/social/media?${new URLSearchParams({ page: String(page) })}`;
    const result = await fetchOne({ label: `Media library page ${page}`, url });
    endpoints.push(result);
    if (result.status === 'ok' && result.data && typeof result.data === 'object') {
      const body = result.data as { items?: unknown[] };
      allItems.push(...(body.items ?? []));
    }
  }

  endpoints.push({
    label: 'Media library (all pages combined)',
    url: '/api/social/media?combined=all',
    status: 'ok',
    data: { pages, totalItems: allItems.length, items: allItems },
  });
}

async function fetchAllPostListPages(endpoints: SectionBackendResult[]) {
  for (const state of POST_LIST_FILTER_VALUES) {
    const first = endpoints.find(
      (entry) => entry.label === `Posts list · ${state}` && entry.status === 'ok'
    );
    if (!first?.data || typeof first.data !== 'object') {
      continue;
    }
    const page1 = first.data as { pages?: number; items?: unknown[] };
    const pages = Math.min(MAX_PAGES, Math.max(1, Number(page1.pages) || 1));
    if (pages <= 1) {
      continue;
    }
    const allItems = [...(page1.items ?? [])];
    for (let page = 2; page <= pages; page += 1) {
      const url = `/api/social/posts?${new URLSearchParams({ page: String(page), state })}`;
      const result = await fetchOne({
        label: `Posts list · ${state} · page ${page}`,
        url,
      });
      endpoints.push(result);
      if (result.status === 'ok' && result.data && typeof result.data === 'object') {
        const body = result.data as { items?: unknown[] };
        allItems.push(...(body.items ?? []));
      }
    }
    endpoints.push({
      label: `Posts list · ${state} (all pages combined)`,
      url: `/api/social/posts?state=${state}&combined=all`,
      status: 'ok',
      data: { state, pages, totalItems: allItems.length, items: allItems },
    });
  }
}

async function expandWhatsApp(endpoints: SectionBackendResult[]) {
  const list = endpoints.find(
    (entry) => entry.url === '/api/social/whatsapp/conversations' && entry.status === 'ok'
  );
  if (!list || !Array.isArray(list.data)) {
    return;
  }

  const conversations = list.data as { id: string; waId?: string }[];
  const details = await Promise.all(
    conversations.slice(0, MAX_NESTED).map((conversation) =>
      fetchOne({
        label: `Conversation detail · ${conversation.waId ?? conversation.id}`,
        url: `/api/social/whatsapp/conversations/${conversation.id}`,
      })
    )
  );
  endpoints.push(...details);
}

async function expandAds(endpoints: SectionBackendResult[]) {
  const accountsResult = endpoints.find(
    (entry) => entry.url === '/api/social/ads/accounts' && entry.status === 'ok'
  );
  if (!accountsResult?.data || typeof accountsResult.data !== 'object') {
    return;
  }

  const body = accountsResult.data as { accounts?: { id: string; name?: string }[] };
  const accounts = body.accounts ?? [];
  const details = await Promise.all(
    accounts.slice(0, MAX_NESTED).map((account) =>
      fetchOne({
        label: `Ad account overview · ${account.name ?? account.id}`,
        url: `/api/social/ads/accounts/${encodeURIComponent(account.id)}?datePreset=${ADS_DEFAULT_DATE_PRESET}`,
      })
    )
  );
  endpoints.push(...details);
}

async function expandCalendarGroups(endpoints: SectionBackendResult[]) {
  const calendar = endpoints.find(
    (entry) => entry.label.startsWith('Calendar posts') && entry.status === 'ok'
  );
  if (!calendar || !Array.isArray(calendar.data)) {
    return;
  }

  const groups = [
    ...new Set(
      (calendar.data as { group?: string }[])
        .map((post) => post.group)
        .filter((group): group is string => Boolean(group))
    ),
  ].slice(0, MAX_NESTED);

  const details = await Promise.all(
    groups.map((group) =>
      fetchOne({
        label: `Post group · ${group}`,
        url: `/api/social/posts/${encodeURIComponent(group)}`,
      })
    )
  );
  endpoints.push(...details);
}

function buildComplete(endpoints: SectionBackendResult[]): Record<string, unknown> {
  const complete: Record<string, unknown> = {
    fetchedAt: new Date().toISOString(),
    endpointCount: endpoints.length,
    responses: {},
  };
  const responses = complete.responses as Record<string, unknown>;

  for (const endpoint of endpoints) {
    const key = slug(endpoint.label) || endpoint.url;
    responses[key] = {
      url: endpoint.url,
      status: endpoint.status,
      ...(endpoint.status === 'ok' ? { data: endpoint.data } : { error: endpoint.error }),
    };
  }

  return complete;
}

/** Loads every section API, follows nested detail routes, and returns full payloads. */
export async function loadFullSectionBackend(
  sectionKey: string | undefined
): Promise<SectionBackendLoadResult> {
  const primary = getSectionBackendEndpoints(sectionKey);
  const endpoints: SectionBackendResult[] = [];

  for (const endpoint of primary) {
    endpoints.push(await fetchOne(endpoint));
  }

  if (sectionKey === 'media') {
    await fetchAllMediaPages(endpoints);
  }
  if (sectionKey === 'calendar') {
    await fetchAllPostListPages(endpoints);
    await expandCalendarGroups(endpoints);
  }
  if (sectionKey === 'whatsapp') {
    await expandWhatsApp(endpoints);
  }
  if (sectionKey === 'ads') {
    await expandAds(endpoints);
  }

  return {
    endpoints,
    complete: buildComplete(endpoints),
  };
}
