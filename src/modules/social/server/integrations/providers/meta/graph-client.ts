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
}

type Params = Record<string, string | number | boolean | undefined>;

export async function graphGet<T>(
  config: GraphConfig,
  path: string,
  token: string,
  params: Params = {}
): Promise<T> {
  const url = new URL(`https://graph.facebook.com/${config.version}/${path.replace(/^\//, '')}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  // The OAuth code exchange has no token yet; it authenticates with client_secret instead.
  if (!token) return fetchJson<T>(url);

  url.searchParams.set('access_token', token);
  if (config.appSecret) {
    url.searchParams.set(
      'appsecret_proof',
      createHmac('sha256', config.appSecret).update(token).digest('hex')
    );
  }
  return fetchJson<T>(url);
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
  paging?: { next?: string };
}
