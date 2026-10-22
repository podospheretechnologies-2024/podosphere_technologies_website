import { createHmac } from 'node:crypto';

/**
 * Minimal Meta Graph API client. Deliberately free of `server-only` and env access so the
 * CLI scripts can use it too; callers pass the version, token and (optional) app secret.
 */

export interface GraphConfig {
  version: string;
  /** When set, every call carries `appsecret_proof` (required if "Require App Secret" is on). */
  appSecret?: string;
}

/** Meta rate-limit / throttle Graph error codes (retryable). */
const RATE_LIMIT_CODES = new Set([4, 17, 32]);

/** Missing permission / unapproved feature. Only App Review clears these; a retry never does. */
const PERMISSION_CODES = new Set([10, 200]);

/** Back off before the next page when any usage metric reaches this percent. */
const USAGE_BACKOFF_THRESHOLD = 75;
const USAGE_BACKOFF_MS = 2_000;

export const GRAPH_GET_ALL_DEFAULT_MAX_PAGES = 25;

export class GraphApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: number,
    public subcode?: number,
    public type?: string,
    public fbtraceId?: string
  ) {
    super(message);
  }

  /** Token expired or revoked: the user has to reconnect. */
  get isAuthError() {
    return this.code === 190;
  }

  /** App / user / page rate limit — safe for BullMQ exponential backoff. */
  get isRateLimitError() {
    return this.code !== undefined && RATE_LIMIT_CODES.has(this.code);
  }

  /**
   * The app lacks a permission or feature this endpoint needs (e.g. `pages_read_user_content`,
   * Page Public Content Access). Pending App Review — the token is fine, so don't mark the
   * integration refreshNeeded, and don't retry: the next call fails the same way.
   */
  get isPermissionError() {
    return this.code !== undefined && PERMISSION_CODES.has(this.code);
  }
}

type Params = Record<string, string | number | boolean | undefined>;

export interface GraphGetAllOptions {
  /** Cap on `paging.next` hops (default 25). */
  maxPages?: number;
}

export async function graphGet<T>(
  config: GraphConfig,
  path: string,
  token: string,
  params: Params = {}
): Promise<T> {
  const url = buildGraphUrl(config, path, token, params);
  // The OAuth code exchange has no token yet; it authenticates with client_secret instead.
  if (!token) return fetchJson<T>(url);
  return fetchJson<T>(url);
}

/**
 * Continue from an already-fetched Graph list page, following `paging.next` up to `maxPages`.
 * Used for nested lists (e.g. `business_discovery.media`) where the first page comes from a field expansion.
 */
export async function graphCollectAll<T>(
  config: GraphConfig,
  token: string,
  firstPage: GraphList<T>,
  options: GraphGetAllOptions = {}
): Promise<T[]> {
  const maxPages = options.maxPages ?? GRAPH_GET_ALL_DEFAULT_MAX_PAGES;
  const items: T[] = [...(firstPage.data ?? [])];
  let nextUrl: string | undefined = firstPage.paging?.next;

  for (let page = 1; page < maxPages && nextUrl; page += 1) {
    const result = await fetchJson<GraphList<T>>(withAppSecretProof(new URL(nextUrl), config, token));
    items.push(...(result.data ?? []));
    nextUrl = result.paging?.next;
    if (!(result.data?.length)) break;
  }

  return items;
}

/**
 * Fetch every page of a Graph list edge, following `paging.next` up to `maxPages`.
 * Applies usage-header backoff between pages when Meta reports high load.
 */
export async function graphGetAll<T>(
  config: GraphConfig,
  path: string,
  token: string,
  params: Params = {},
  options: GraphGetAllOptions = {}
): Promise<T[]> {
  const first = await graphGet<GraphList<T>>(config, path, token, params);
  return graphCollectAll(config, token, first, options);
}

/** JSON POST (WhatsApp Cloud API). The token goes in the Authorization header, not the URL. */
export async function graphPost<T>(
  config: GraphConfig,
  path: string,
  token: string,
  body: unknown
): Promise<T> {
  const url = new URL(`https://graph.facebook.com/${config.version}/${path.replace(/^\//, '')}`);
  if (config.appSecret) {
    url.searchParams.set(
      'appsecret_proof',
      createHmac('sha256', config.appSecret).update(token).digest('hex')
    );
  }
  return fetchJson<T>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
}

function buildGraphUrl(config: GraphConfig, path: string, token: string, params: Params): URL {
  const url = new URL(`https://graph.facebook.com/${config.version}/${path.replace(/^\//, '')}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  if (token) {
    url.searchParams.set('access_token', token);
    if (config.appSecret) {
      url.searchParams.set(
        'appsecret_proof',
        createHmac('sha256', config.appSecret).update(token).digest('hex')
      );
    }
  }
  return url;
}

function withAppSecretProof(url: URL, config: GraphConfig, token: string): URL {
  if (config.appSecret && token) {
    url.searchParams.set(
      'appsecret_proof',
      createHmac('sha256', config.appSecret).update(token).digest('hex')
    );
  }
  return url;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Highest percent among call_count / total_cputime / total_time in `x-app-usage`. */
function maxAppUsagePercent(raw: string | null): number {
  if (!raw) return 0;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return Math.max(
      Number(parsed.call_count) || 0,
      Number(parsed.total_cputime) || 0,
      Number(parsed.total_time) || 0
    );
  } catch {
    return 0;
  }
}

/** Highest percent across business-use-case usage buckets. */
function maxBusinessUsagePercent(raw: string | null): number {
  if (!raw) return 0;
  try {
    const parsed = JSON.parse(raw) as Record<string, Array<Record<string, unknown>>>;
    let max = 0;
    for (const entries of Object.values(parsed)) {
      if (!Array.isArray(entries)) continue;
      for (const entry of entries) {
        max = Math.max(
          max,
          Number(entry.call_count) || 0,
          Number(entry.total_cputime) || 0,
          Number(entry.total_time) || 0
        );
      }
    }
    return max;
  } catch {
    return 0;
  }
}

async function maybeBackoffFromUsageHeaders(headers: Headers): Promise<void> {
  const usage = Math.max(
    maxAppUsagePercent(headers.get('x-app-usage')),
    maxBusinessUsagePercent(headers.get('x-business-use-case-usage'))
  );
  if (usage < USAGE_BACKOFF_THRESHOLD) return;
  const delayMs = USAGE_BACKOFF_MS + Math.floor((usage - USAGE_BACKOFF_THRESHOLD) * 80);
  await sleep(delayMs);
}

async function fetchJson<T>(url: URL, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { Accept: 'application/json', ...init.headers },
    cache: 'no-store',
  });
  const body = await res.json().catch(() => ({}));

  if (!res.ok || body.error) {
    const e = body.error ?? {};
    throw new GraphApiError(
      e.message ?? `Graph API request failed (${res.status})`,
      res.status,
      e.code,
      e.error_subcode,
      e.type,
      e.fbtrace_id
    );
  }

  // Delay before the caller’s next page/request when Meta reports high usage.
  await maybeBackoffFromUsageHeaders(res.headers);

  return body as T;
}

// ─── Shapes we read ──────────────────────────────────────────────────────────

export interface GraphPage {
  id: string;
  name: string;
  access_token?: string;
  category?: string;
  tasks?: string[];
  picture?: { data: { url: string } };
  instagram_business_account?: { id: string; username?: string; profile_picture_url?: string };
}

export interface GraphList<T> {
  data: T[];
  paging?: { next?: string; cursors?: { after?: string; before?: string } };
}
