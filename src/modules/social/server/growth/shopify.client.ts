import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { getServerEnv } from '@/shared/lib/env';
import { HttpError } from '@/shared/server/http-error';
import { fetchPublicUrl } from '@/shared/server/public-fetch';

/** POST to the store's own *.myshopify.com host only; never follows redirects (token header). */
async function safePublicFetch(
  url: string,
  init: { method: string; headers: Record<string, string>; body: string }
): Promise<Response> {
  const { response } = await fetchPublicUrl(url, { ...init, timeoutMs: 30_000, maxRedirects: 0 });
  return response;
}

/**
 * Thin Shopify Admin GraphQL client for the Growth Desk.
 *
 * Read scopes used: read_orders (orders, sales), read_reports (ShopifyQL sessions — optional),
 * read_content + write_content (blog publish — optional, only on an explicit Publish).
 * Nothing here touches products, prices, discounts or theme.
 */

export class ShopifyApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly isAuthError = false
  ) {
    super(message);
    this.name = 'ShopifyApiError';
  }
}

const SHOP_DOMAIN_RE = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;

/** Accepts "my-store", "my-store.myshopify.com" or "https://my-store.myshopify.com/admin". */
export function normalizeShopDomain(input: string): string {
  let value = input.trim().toLowerCase();
  value = value.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (value && !value.includes('.')) value = `${value}.myshopify.com`;
  if (!SHOP_DOMAIN_RE.test(value)) {
    throw new HttpError(
      400,
      'Enter the store\'s myshopify.com address, e.g. "siyara-beauty.myshopify.com" (Shopify admin → Settings → Domains).'
    );
  }
  return value;
}

export async function shopifyGraphql<T>(
  shopDomain: string,
  accessToken: string,
  query: string,
  variables: Record<string, unknown> = {}
): Promise<T> {
  const version = getServerEnv().SHOPIFY_API_VERSION;
  const response = await safePublicFetch(`https://${shopDomain}/admin/api/${version}/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': accessToken,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (response.status === 401 || response.status === 403) {
    throw new ShopifyApiError(
      response.status === 401
        ? 'Shopify rejected the access token. Create a new token and connect again.'
        : 'The token is missing a permission (scope) this needs.',
      response.status,
      true
    );
  }
  if (response.status === 429) {
    throw new ShopifyApiError('Shopify rate limit reached. Try again in a minute.', 429);
  }
  if (!response.ok) {
    throw new ShopifyApiError(`Shopify returned ${response.status}`, response.status);
  }

  const payload = (await response.json()) as {
    data?: T;
    errors?: { message: string; extensions?: { code?: string } }[] | string;
  };
  if (payload.errors) {
    const errors = Array.isArray(payload.errors) ? payload.errors : [{ message: String(payload.errors) }];
    const denied = errors.some((e) => e.extensions?.code === 'ACCESS_DENIED');
    throw new ShopifyApiError(errors.map((e) => e.message).join('; ').slice(0, 500), denied ? 403 : 400, denied);
  }
  if (!payload.data) throw new ShopifyApiError('Shopify returned no data', 502);
  return payload.data;
}

/** Dev Dashboard apps: exchange client id + secret for a short-lived Admin API token. */
export async function exchangeClientCredentials(
  shopDomain: string,
  clientId: string,
  clientSecret: string
): Promise<{ accessToken: string; scope: string | null; expiresAt: Date | null }> {
  const response = await safePublicFetch(`https://${shopDomain}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }).toString(),
  });
  if (!response.ok) {
    throw new ShopifyApiError(
      'Shopify did not accept the client ID and secret. Check that the app is installed on this store.',
      response.status,
      true
    );
  }
  const body = (await response.json()) as { access_token?: string; scope?: string; expires_in?: number };
  if (!body.access_token) throw new ShopifyApiError('Shopify returned no access token', 502, true);
  return {
    accessToken: body.access_token,
    scope: body.scope ?? null,
    expiresAt: body.expires_in ? new Date(Date.now() + (body.expires_in - 300) * 1000) : null,
  };
}

// ---------- queries ----------

export interface ShopInfo {
  name: string;
  currencyCode: string;
  ianaTimezone: string;
  myshopifyDomain: string;
  primaryUrl: string | null;
}

export async function fetchShopInfo(shopDomain: string, token: string): Promise<ShopInfo> {
  const data = await shopifyGraphql<{
    shop: {
      name: string;
      currencyCode: string;
      ianaTimezone: string;
      myshopifyDomain: string;
      primaryDomain: { url: string } | null;
    };
  }>(
    shopDomain,
    token,
    `{ shop { name currencyCode ianaTimezone myshopifyDomain primaryDomain { url } } }`
  );
  return {
    name: data.shop.name,
    currencyCode: data.shop.currencyCode,
    ianaTimezone: data.shop.ianaTimezone,
    myshopifyDomain: data.shop.myshopifyDomain,
    primaryUrl: data.shop.primaryDomain?.url ?? null,
  };
}

export async function fetchGrantedScopes(shopDomain: string, token: string): Promise<string[]> {
  try {
    const data = await shopifyGraphql<{
      currentAppInstallation: { accessScopes: { handle: string }[] };
    }>(shopDomain, token, `{ currentAppInstallation { accessScopes { handle } } }`);
    return data.currentAppInstallation.accessScopes.map((s) => s.handle);
  } catch {
    return [];
  }
}

export interface ShopifyOrderLite {
  createdAt: string;
  cancelledAt: string | null;
  test: boolean;
  total: number;
}

const ORDERS_QUERY = `
query Orders($cursor: String, $query: String!) {
  orders(first: 250, after: $cursor, query: $query, sortKey: CREATED_AT) {
    pageInfo { hasNextPage endCursor }
    nodes {
      createdAt
      cancelledAt
      test
      currentTotalPriceSet { shopMoney { amount } }
    }
  }
}`;

/** Orders created on or after `sinceIso` (read_orders covers the last 60 days). Max 40 pages. */
export async function fetchOrdersSince(
  shopDomain: string,
  token: string,
  sinceIso: string
): Promise<ShopifyOrderLite[]> {
  const out: ShopifyOrderLite[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < 40; page += 1) {
    const data: {
      orders: {
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
        nodes: {
          createdAt: string;
          cancelledAt: string | null;
          test: boolean;
          currentTotalPriceSet: { shopMoney: { amount: string } } | null;
        }[];
      };
    } = await shopifyGraphql(shopDomain, token, ORDERS_QUERY, {
      cursor,
      query: `created_at:>='${sinceIso}'`,
    });
    for (const node of data.orders.nodes) {
      out.push({
        createdAt: node.createdAt,
        cancelledAt: node.cancelledAt,
        test: node.test,
        total: Number.parseFloat(node.currentTotalPriceSet?.shopMoney.amount ?? '0') || 0,
      });
    }
    if (!data.orders.pageInfo.hasNextPage) break;
    cursor = data.orders.pageInfo.endCursor;
  }
  return out;
}

export interface ShopifyqlTable {
  columns: string[];
  rows: Record<string, unknown>[];
}

/**
 * ShopifyQL (read_reports). Availability and field names depend on the store's plan and the API
 * version, so callers must treat any error as "traffic not available" and keep going.
 */
export async function runShopifyql(shopDomain: string, token: string, query: string): Promise<ShopifyqlTable> {
  const data = await shopifyGraphql<{
    shopifyqlQuery: {
      parseErrors?: unknown;
      tableData?: { columns?: { name: string }[]; rows?: unknown[] } | null;
    } | null;
  }>(
    shopDomain,
    token,
    `query Q($q: String!) { shopifyqlQuery(query: $q) { parseErrors tableData { columns { name } rows } } }`,
    { q: query }
  );
  const result = data.shopifyqlQuery;
  const parseErrors = result?.parseErrors;
  if (parseErrors && (!Array.isArray(parseErrors) || parseErrors.length > 0)) {
    throw new ShopifyApiError(`ShopifyQL: ${JSON.stringify(parseErrors).slice(0, 300)}`, 400);
  }
  const columns = (result?.tableData?.columns ?? []).map((c) => c.name);
  const rawRows = result?.tableData?.rows ?? [];
  const rows = rawRows.map((row) => {
    if (Array.isArray(row)) {
      return Object.fromEntries(columns.map((name, index) => [name, row[index]]));
    }
    if (typeof row === 'string') {
      try {
        const parsed = JSON.parse(row) as unknown;
        if (Array.isArray(parsed)) return Object.fromEntries(columns.map((name, i) => [name, parsed[i]]));
        return (parsed ?? {}) as Record<string, unknown>;
      } catch {
        return {};
      }
    }
    return (row ?? {}) as Record<string, unknown>;
  });
  return { columns, rows };
}

export async function listBlogs(
  shopDomain: string,
  token: string
): Promise<{ id: string; title: string; handle: string }[]> {
  const data = await shopifyGraphql<{ blogs: { nodes: { id: string; title: string; handle: string }[] } }>(
    shopDomain,
    token,
    `{ blogs(first: 20) { nodes { id title handle } } }`
  );
  return data.blogs.nodes;
}

/**
 * Verifies X-Shopify-Hmac-Sha256 (base64 HMAC-SHA256 of the raw body with the app client secret).
 * Token-only stores have no client secret — signature verify requires reconnecting with client id + secret.
 */
export function verifyShopifyWebhookHmac(rawBody: string, hmacHeader: string | null, clientSecret: string): boolean {
  if (!hmacHeader) return false;
  const expected = createHmac('sha256', clientSecret).update(rawBody, 'utf8').digest('base64');
  const a = Buffer.from(expected);
  const b = Buffer.from(hmacHeader);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** REST topic (`orders/create`) → GraphQL WebhookSubscriptionTopic (`ORDERS_CREATE`). */
const REST_TO_GQL_WEBHOOK_TOPIC: Record<string, string> = {
  'orders/create': 'ORDERS_CREATE',
  'orders/paid': 'ORDERS_PAID',
  'orders/cancelled': 'ORDERS_CANCELLED',
  'orders/fulfilled': 'ORDERS_FULFILLED',
  'fulfillments/create': 'FULFILLMENTS_CREATE',
  'refunds/create': 'REFUNDS_CREATE',
  'checkouts/create': 'CHECKOUTS_CREATE',
  'checkouts/update': 'CHECKOUTS_UPDATE',
};

export function toShopifyGraphqlWebhookTopic(topic: string): string {
  const trimmed = topic.trim();
  if (trimmed.includes('/')) {
    const mapped = REST_TO_GQL_WEBHOOK_TOPIC[trimmed.toLowerCase()];
    if (!mapped) throw new HttpError(400, `Unsupported Shopify webhook topic: ${topic}`);
    return mapped;
  }
  return trimmed.toUpperCase();
}

export interface ShopifyWebhookSubscription {
  id: string;
  topic: string;
  callbackUrl: string | null;
}

const WEBHOOK_LIST_QUERY = `{
  webhookSubscriptions(first: 50) {
    nodes {
      id
      topic
      endpoint {
        __typename
        ... on WebhookHttpEndpoint { callbackUrl }
      }
    }
  }
}`;

export async function listWebhookSubscriptions(
  shopDomain: string,
  token: string
): Promise<ShopifyWebhookSubscription[]> {
  const data = await shopifyGraphql<{
    webhookSubscriptions: {
      nodes: {
        id: string;
        topic: string;
        endpoint: { __typename: string; callbackUrl?: string } | null;
      }[];
    };
  }>(shopDomain, token, WEBHOOK_LIST_QUERY);
  return data.webhookSubscriptions.nodes.map((node) => ({
    id: node.id,
    topic: node.topic,
    callbackUrl: node.endpoint && 'callbackUrl' in node.endpoint ? (node.endpoint.callbackUrl ?? null) : null,
  }));
}

/** Alias: list Admin API webhook subscriptions for a shop. */
export async function listWebhooks(shop: string, token: string): Promise<ShopifyWebhookSubscription[]> {
  return listWebhookSubscriptions(shop, token);
}

const WEBHOOK_CREATE_MUTATION = `
mutation CreateWebhook($topic: WebhookSubscriptionTopic!, $webhookSubscription: WebhookSubscriptionInput!) {
  webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) {
    webhookSubscription { id topic }
    userErrors { field message }
  }
}`;

export async function createWebhookSubscription(
  shopDomain: string,
  token: string,
  topic: string,
  callbackUrl: string
): Promise<string> {
  const gqlTopic = toShopifyGraphqlWebhookTopic(topic);
  const data = await shopifyGraphql<{
    webhookSubscriptionCreate: {
      webhookSubscription: { id: string; topic: string } | null;
      userErrors: { field?: string[]; message: string }[];
    };
  }>(shopDomain, token, WEBHOOK_CREATE_MUTATION, {
    topic: gqlTopic,
    webhookSubscription: { uri: callbackUrl, format: 'JSON' },
  });
  const result = data.webhookSubscriptionCreate;
  if (result.userErrors.length || !result.webhookSubscription) {
    throw new ShopifyApiError(
      result.userErrors.map((e) => e.message).join('; ') || `Could not register ${gqlTopic}`,
      400
    );
  }
  return result.webhookSubscription.id;
}

/** Alias: register one webhook (`topic` may be REST or GraphQL form). */
export async function createWebhook(
  shop: string,
  token: string,
  opts: { topic: string; address: string }
): Promise<string> {
  return createWebhookSubscription(shop, token, opts.topic, opts.address);
}

const WEBHOOK_DELETE_MUTATION = `
mutation DeleteWebhook($id: ID!) {
  webhookSubscriptionDelete(id: $id) {
    deletedWebhookSubscriptionId
    userErrors { field message }
  }
}`;

export async function deleteWebhookSubscription(shopDomain: string, token: string, id: string): Promise<void> {
  const data = await shopifyGraphql<{
    webhookSubscriptionDelete: {
      deletedWebhookSubscriptionId: string | null;
      userErrors: { field?: string[]; message: string }[];
    };
  }>(shopDomain, token, WEBHOOK_DELETE_MUTATION, { id });
  const errors = data.webhookSubscriptionDelete.userErrors;
  if (errors.length) {
    throw new ShopifyApiError(errors.map((e) => e.message).join('; '), 400);
  }
}

/** Alias: delete a webhook subscription by Admin API id. */
export async function deleteWebhook(shop: string, token: string, id: string): Promise<void> {
  return deleteWebhookSubscription(shop, token, id);
}

export async function createArticle(
  shopDomain: string,
  token: string,
  input: {
    blogId: string;
    title: string;
    bodyHtml: string;
    summary?: string | null;
    handle?: string | null;
    imageUrl?: string | null;
    author: string;
    tags?: string[];
  }
): Promise<{ id: string; handle: string; blogHandle: string }> {
  const data = await shopifyGraphql<{
    articleCreate: {
      article: { id: string; handle: string; blog: { handle: string } } | null;
      userErrors: { field?: string[]; message: string }[];
    };
  }>(
    shopDomain,
    token,
    `mutation Create($article: ArticleCreateInput!) {
      articleCreate(article: $article) {
        article { id handle blog { handle } }
        userErrors { field message }
      }
    }`,
    {
      article: {
        blogId: input.blogId,
        title: input.title,
        body: input.bodyHtml,
        summary: input.summary ?? undefined,
        handle: input.handle ?? undefined,
        isPublished: true,
        author: { name: input.author },
        tags: input.tags?.length ? input.tags : undefined,
        image: input.imageUrl ? { url: input.imageUrl, altText: input.title } : undefined,
      },
    }
  );
  const result = data.articleCreate;
  if (result.userErrors.length || !result.article) {
    throw new ShopifyApiError(
      result.userErrors.map((e) => e.message).join('; ') || 'Shopify did not create the article',
      400
    );
  }
  return { id: result.article.id, handle: result.article.handle, blogHandle: result.article.blog.handle };
}
