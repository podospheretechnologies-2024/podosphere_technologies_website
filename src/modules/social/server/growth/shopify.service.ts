import 'server-only';
import { prisma } from '@/shared/lib/prisma';
import { decrypt, encrypt } from '@/shared/lib/crypto';
import { getServerEnv } from '@/shared/lib/env';
import { HttpError } from '@/shared/server/http-error';
import type { SocialShopifyStore } from '@/generated/prisma/client';
import { SHOPIFY_ORDER_FLOW_TOPICS } from '@/modules/social/config/order-flows';
import {
  SHOPIFY_ACCESS_CHECKS,
  SHOPIFY_ALL_SCOPES,
  SHOPIFY_LIVE_EVENT_SCOPES,
  hasShopifyScope,
  type ShopifyAccessGroup,
} from '@/modules/social/config/shopify-scopes';
import {
  ShopifyApiError,
  createWebhook,
  deleteWebhook,
  exchangeClientCredentials,
  fetchGrantedScopes,
  fetchOrdersSince,
  fetchShopInfo,
  listWebhooks,
  normalizeShopDomain,
  runShopifyql,
  toShopifyGraphqlWebhookTopic,
  type ShopifyqlTable,
} from './shopify.client';
import {
  bucketOrders,
  dayToDate,
  daysBetween,
  localDay,
  parseBreakdown,
  parseTrafficByDay,
  shiftDay,
  type TrafficDay,
} from './growth-metrics';

/** read_orders only returns the last 60 days of orders. */
const ORDER_LOOKBACK_DAYS = 60;
const TRAFFIC_BREAKDOWN_DAYS = 30;
const WEBHOOK_STALE_MS = 24 * 60 * 60 * 1000;

/** Scopes for live order / shipping / abandoned-checkout events (Option 1). */
export const LIVE_EVENT_SCOPES = SHOPIFY_LIVE_EVENT_SCOPES;

export type WebhookHealth = 'off' | 'never' | 'ok' | 'stale';

export interface AccessCheckRow {
  key: string;
  label: string;
  group: ShopifyAccessGroup;
  ok: boolean;
  /** False while the dashboard does not read this data yet. */
  inUse: boolean;
  scopes: string[];
  /** The scopes of this row that the store has not granted. */
  missing: string[];
}

export interface ShopifyStoreDto {
  connected: boolean;
  shopDomain: string | null;
  shopName: string | null;
  primaryUrl: string | null;
  currency: string | null;
  timeZone: string | null;
  authMode: string | null;
  scopes: string[];
  missingScopes: string[];
  accessChecks: AccessCheckRow[];
  canEnableLiveEvents: boolean;
  /** False when store was connected with a pasted token only (no client secret for HMAC). */
  hasClientSecret: boolean;
  webhooksEnabled: boolean;
  lastWebhookAt: string | null;
  webhookHealth: WebhookHealth;
  orderFlowsPaused: boolean;
  orderFlowsPausedReason: string | null;
  status: string | null;
  lastError: string | null;
  lastSyncedAt: string | null;
  trafficAvailable: boolean | null;
  trafficError: string | null;
}

function webhookCallbackUrl(): string {
  const base = getServerEnv().APP_URL.replace(/\/$/, '');
  return `${base}/api/webhooks/shopify`;
}

function computeWebhookHealth(store: SocialShopifyStore | null): WebhookHealth {
  if (!store?.webhooksEnabled) return 'off';
  if (!store.lastWebhookAt) return 'never';
  return Date.now() - store.lastWebhookAt.getTime() > WEBHOOK_STALE_MS ? 'stale' : 'ok';
}

function toDto(store: SocialShopifyStore | null): ShopifyStoreDto {
  const scopes = store?.scopes ? store.scopes.split(',').map((s) => s.trim()).filter(Boolean) : [];
  const accessChecks: AccessCheckRow[] = SHOPIFY_ACCESS_CHECKS.map((row) => {
    const missing = row.scopes.filter((s) => !hasShopifyScope(scopes, s));
    return {
      key: row.key,
      label: row.label,
      group: row.group,
      inUse: row.inUse,
      scopes: [...row.scopes],
      missing,
      ok: missing.length === 0,
    };
  });
  const missingLive = LIVE_EVENT_SCOPES.filter((s) => !hasShopifyScope(scopes, s));
  const hasSecret = Boolean(store?.clientSecretEncrypted);
  return {
    connected: Boolean(store),
    shopDomain: store?.shopDomain ?? null,
    shopName: store?.shopName ?? null,
    primaryUrl: store?.primaryUrl ?? null,
    currency: store?.currency ?? null,
    timeZone: store?.timeZone ?? null,
    authMode: store?.authMode ?? null,
    scopes,
    missingScopes: store ? SHOPIFY_ALL_SCOPES.filter((s) => !hasShopifyScope(scopes, s)) : [],
    accessChecks,
    canEnableLiveEvents: Boolean(store) && missingLive.length === 0 && hasSecret,
    hasClientSecret: hasSecret,
    webhooksEnabled: store?.webhooksEnabled ?? false,
    lastWebhookAt: store?.lastWebhookAt?.toISOString() ?? null,
    webhookHealth: computeWebhookHealth(store),
    orderFlowsPaused: store?.orderFlowsPaused ?? false,
    orderFlowsPausedReason: store?.orderFlowsPausedReason ?? null,
    status: store?.status ?? null,
    lastError: store?.lastError ?? null,
    lastSyncedAt: store?.lastSyncedAt?.toISOString() ?? null,
    trafficAvailable: store?.trafficAvailable ?? null,
    trafficError: store?.trafficError ?? null,
  };
}

export interface ConnectInput {
  shopDomain: string;
  accessToken?: string;
  clientId?: string;
  clientSecret?: string;
}

/** Fresh Admin API token for a store; refreshes client-credential tokens when expired. */
export async function resolveStoreToken(store: SocialShopifyStore): Promise<string> {
  if (store.authMode === 'client_credentials') {
    const valid = store.tokenExpiresAt && store.tokenExpiresAt.getTime() > Date.now() && store.accessTokenEncrypted;
    if (valid) return decrypt(store.accessTokenEncrypted!);
    if (!store.clientId || !store.clientSecretEncrypted) {
      throw new ShopifyApiError('Client ID / secret missing. Connect the store again.', 401, true);
    }
    const fresh = await exchangeClientCredentials(store.shopDomain, store.clientId, decrypt(store.clientSecretEncrypted));
    await prisma.socialShopifyStore.update({
      where: { id: store.id },
      data: { accessTokenEncrypted: encrypt(fresh.accessToken), tokenExpiresAt: fresh.expiresAt },
    });
    return fresh.accessToken;
  }
  if (!store.accessTokenEncrypted) throw new ShopifyApiError('No access token saved. Connect again.', 401, true);
  return decrypt(store.accessTokenEncrypted);
}

export const shopifyService = {
  async get(organizationId: string, customerId: string): Promise<ShopifyStoreDto> {
    const store = await prisma.socialShopifyStore.findFirst({ where: { organizationId, customerId } });
    return toDto(store);
  },

  async connect(organizationId: string, customerId: string, input: ConnectInput): Promise<ShopifyStoreDto> {
    const shopDomain = normalizeShopDomain(input.shopDomain);
    const usingToken = Boolean(input.accessToken?.trim());
    if (!usingToken && !(input.clientId?.trim() && input.clientSecret?.trim())) {
      throw new HttpError(400, 'Paste the Admin API access token, or the client ID and client secret.');
    }

    const taken = await prisma.socialShopifyStore.findFirst({
      where: { shopDomain, NOT: { customerId } },
      select: { id: true },
    });
    if (taken) throw new HttpError(409, 'This store is already connected to another client.');

    let accessToken: string;
    let expiresAt: Date | null = null;
    let grantedScope: string | null = null;
    try {
      if (usingToken) {
        accessToken = input.accessToken!.trim();
      } else {
        const fresh = await exchangeClientCredentials(shopDomain, input.clientId!.trim(), input.clientSecret!.trim());
        accessToken = fresh.accessToken;
        expiresAt = fresh.expiresAt;
        grantedScope = fresh.scope;
      }
      const shop = await fetchShopInfo(shopDomain, accessToken);
      const scopes = grantedScope ? grantedScope.split(',') : await fetchGrantedScopes(shopDomain, accessToken);
      if (scopes.length && !scopes.includes('read_orders')) {
        throw new HttpError(400, 'The app needs the read_orders permission. Add it in the app settings, reinstall, then connect again.');
      }

      const data = {
        organizationId,
        customerId,
        shopDomain,
        shopName: shop.name,
        primaryUrl: shop.primaryUrl,
        currency: shop.currencyCode,
        timeZone: shop.ianaTimezone || 'Asia/Kolkata',
        authMode: usingToken ? 'token' : 'client_credentials',
        accessTokenEncrypted: encrypt(accessToken),
        clientId: usingToken ? null : input.clientId!.trim(),
        clientSecretEncrypted: usingToken ? null : encrypt(input.clientSecret!.trim()),
        tokenExpiresAt: expiresAt,
        scopes: scopes.join(','),
        status: 'active',
        lastError: null,
        trafficAvailable: null,
        trafficError: null,
        // Token-only stores cannot verify webhook HMAC — keep live events off.
        ...(usingToken ? { webhooksEnabled: false as const } : {}),
      };
      const store = await prisma.socialShopifyStore.upsert({
        where: { customerId },
        update: data,
        create: data,
      });
      return toDto(store);
    } catch (error) {
      if (error instanceof ShopifyApiError) {
        throw new HttpError(error.isAuthError ? 400 : 502, error.message);
      }
      throw error;
    }
  },

  async disconnect(organizationId: string, customerId: string): Promise<void> {
    const store = await prisma.socialShopifyStore.findFirst({ where: { organizationId, customerId } });
    if (store?.webhooksEnabled) {
      try {
        await this.disableLiveEvents(organizationId, customerId);
      } catch (error) {
        console.error(`[growth] Shopify webhook cleanup failed for ${store.shopDomain}:`, error);
      }
    }
    await prisma.socialShopifyStore.deleteMany({ where: { organizationId, customerId } });
  },

  /** Re-fetch granted scopes from Shopify and refresh the access ticks. */
  async recheckScopes(organizationId: string, customerId: string): Promise<ShopifyStoreDto> {
    const store = await requireStore(organizationId, customerId);
    try {
      const token = await resolveStoreToken(store);
      const scopes = await fetchGrantedScopes(store.shopDomain, token);
      const updated = await prisma.socialShopifyStore.update({
        where: { id: store.id },
        data: {
          scopes: scopes.join(','),
          status: 'active',
          lastError: null,
        },
      });
      return toDto(updated);
    } catch (error) {
      if (error instanceof ShopifyApiError) {
        throw new HttpError(error.isAuthError ? 400 : 502, error.message);
      }
      throw error;
    }
  },

  /**
   * Registers SHOPIFY_ORDER_FLOW_TOPICS to APP_URL/api/webhooks/shopify.
   * Needs client ID + secret (HMAC verify) and the live-event scopes.
   * Token-only stores must reconnect with client id + secret before enabling.
   */
  async enableLiveEvents(organizationId: string, customerId: string): Promise<ShopifyStoreDto> {
    const store = await requireStore(organizationId, customerId);
    if (!store.clientSecretEncrypted) {
      throw new HttpError(
        400,
        'Live events need the app client secret to verify Shopify signatures. Reconnect with Client ID + secret (not a pasted Admin API access token).'
      );
    }
    const scopes = store.scopes ? store.scopes.split(',').map((s) => s.trim()).filter(Boolean) : [];
    const missing = LIVE_EVENT_SCOPES.filter((s) => !hasShopifyScope(scopes, s));
    if (missing.length) {
      throw new HttpError(
        400,
        `Add these permissions on the Shopify app, reinstall, then Re-check: ${missing.join(', ')}.`
      );
    }

    const callbackUrl = webhookCallbackUrl();
    if (!callbackUrl.startsWith('https://') && getServerEnv().NODE_ENV === 'production') {
      throw new HttpError(400, 'APP_URL must be HTTPS in production for Shopify webhooks.');
    }

    try {
      const token = await resolveStoreToken(store);
      const existing = await listWebhooks(store.shopDomain, token);
      const wanted = new Set(SHOPIFY_ORDER_FLOW_TOPICS.map((t) => toShopifyGraphqlWebhookTopic(t)));

      const created: string[] = [];
      const failures: string[] = [];
      for (const topic of SHOPIFY_ORDER_FLOW_TOPICS) {
        const gqlTopic = toShopifyGraphqlWebhookTopic(topic);
        const match = existing.find((w) => {
          try {
            return toShopifyGraphqlWebhookTopic(w.topic) === gqlTopic;
          } catch {
            return false;
          }
        });
        if (match?.callbackUrl && urlsMatch(match.callbackUrl, callbackUrl)) {
          created.push(match.id);
          continue;
        }
        if (match) {
          try {
            await deleteWebhook(store.shopDomain, token, match.id);
          } catch (error) {
            console.error(`[growth] Failed to replace Shopify webhook ${match.id}:`, error);
          }
        }
        try {
          created.push(await createWebhook(store.shopDomain, token, { topic, address: callbackUrl }));
        } catch (error) {
          failures.push(`${topic}: ${error instanceof Error ? error.message : 'failed'}`);
        }
      }

      // Drop leftover Podo callbacks for topics we no longer register.
      const refreshed = await listWebhooks(store.shopDomain, token);
      for (const hook of refreshed) {
        if (!hook.callbackUrl || !urlsMatch(hook.callbackUrl, callbackUrl)) continue;
        let gql = '';
        try {
          gql = toShopifyGraphqlWebhookTopic(hook.topic);
        } catch {
          continue;
        }
        if (wanted.has(gql)) continue;
        try {
          await deleteWebhook(store.shopDomain, token, hook.id);
        } catch (error) {
          console.error(`[growth] Failed to delete obsolete Shopify webhook ${hook.id}:`, error);
        }
      }

      if (created.length === 0) {
        throw new HttpError(502, `Could not register any webhooks. ${failures.join('; ')}`);
      }

      const updated = await prisma.socialShopifyStore.update({
        where: { id: store.id },
        data: {
          webhooksEnabled: true,
          status: 'active',
          lastError: failures.length ? `Some topics failed: ${failures.join('; ')}`.slice(0, 1000) : null,
        },
      });
      return toDto(updated);
    } catch (error) {
      if (error instanceof HttpError) throw error;
      if (error instanceof ShopifyApiError) {
        throw new HttpError(error.isAuthError ? 400 : 502, error.message);
      }
      throw error;
    }
  },

  /** Unregisters our callback webhooks and clears the live-events flag. */
  async disableLiveEvents(organizationId: string, customerId: string): Promise<ShopifyStoreDto> {
    const store = await requireStore(organizationId, customerId);
    try {
      const token = await resolveStoreToken(store);
      await removeOurWebhooks(store.shopDomain, token, webhookCallbackUrl());
    } catch (error) {
      // Still mark disabled locally if Shopify rejects (app deleted / secret rotated).
      console.error(`[growth] disableLiveEvents Shopify call failed for ${store.shopDomain}:`, error);
    }
    const updated = await prisma.socialShopifyStore.update({
      where: { id: store.id },
      data: { webhooksEnabled: false },
    });
    return toDto(updated);
  },

  /** Pulls the last 60 days of orders and (when available) traffic into daily rows + a funnel snapshot. */
  async syncStore(storeId: string): Promise<{ days: number; traffic: boolean }> {
    const store = await prisma.socialShopifyStore.findUnique({ where: { id: storeId } });
    if (!store) return { days: 0, traffic: false };

    try {
      const token = await resolveStoreToken(store);
      const today = localDay(new Date(), store.timeZone);
      const since = shiftDay(today, -(ORDER_LOOKBACK_DAYS - 1));
      const orders = await fetchOrdersSince(store.shopDomain, token, `${since}T00:00:00Z`);
      const buckets = bucketOrders(orders, store.timeZone);

      const { traffic, trafficError } = await fetchDailyTraffic(store.shopDomain, token);

      for (const day of daysBetween(since, today)) {
        const bucket = buckets.get(day) ?? { orders: 0, sales: 0, cancelledOrders: 0, cancelledSales: 0 };
        const t = traffic?.get(day);
        const row = {
          orders: bucket.orders,
          sales: bucket.sales.toFixed(2),
          cancelledOrders: bucket.cancelledOrders,
          cancelledSales: bucket.cancelledSales.toFixed(2),
          ...(traffic ? { sessions: t?.sessions ?? 0, addToCart: t?.addToCart ?? null, checkouts: t?.checkouts ?? null } : {}),
        };
        await prisma.shopifyDailyMetric.upsert({
          where: { storeId_date: { storeId: store.id, date: dayToDate(day) } },
          update: row,
          create: {
            storeId: store.id,
            organizationId: store.organizationId,
            customerId: store.customerId,
            date: dayToDate(day),
            ...row,
          },
        });
      }

      if (traffic) {
        await saveTrafficSnapshot(store, token, today, buckets);
      }

      await prisma.socialShopifyStore.update({
        where: { id: store.id },
        data: {
          status: 'active',
          lastError: null,
          lastSyncedAt: new Date(),
          trafficAvailable: Boolean(traffic),
          trafficError: traffic ? null : trafficError,
        },
      });
      return { days: ORDER_LOOKBACK_DAYS, traffic: Boolean(traffic) };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sync failed';
      await prisma.socialShopifyStore.update({
        where: { id: store.id },
        data: { status: 'error', lastError: message.slice(0, 1000) },
      });
      if (error instanceof ShopifyApiError && error.status === 429) throw error; // let BullMQ retry
      console.error(`[growth] Shopify sync failed for ${store.shopDomain}: ${message}`);
      return { days: 0, traffic: false };
    }
  },
};

/** Tries both ShopifyQL time-series spellings; returns null + reason when the store does not expose sessions. */
async function fetchDailyTraffic(
  shopDomain: string,
  token: string
): Promise<{ traffic: Map<string, TrafficDay> | null; trafficError: string | null }> {
  const metrics = 'sessions, sessions_with_cart_additions, sessions_that_completed_checkout';
  const attempts = [
    `FROM sessions SHOW ${metrics} TIMESERIES day SINCE -${ORDER_LOOKBACK_DAYS}d UNTIL today`,
    `FROM sessions SHOW ${metrics} GROUP BY day SINCE -${ORDER_LOOKBACK_DAYS}d UNTIL today ORDER BY day`,
    `FROM sessions SHOW sessions GROUP BY day SINCE -${ORDER_LOOKBACK_DAYS}d UNTIL today ORDER BY day`,
  ];
  let lastError = 'Shopify did not return session data.';
  for (const query of attempts) {
    try {
      const table = await runShopifyql(shopDomain, token, query);
      const parsed = parseTrafficByDay(table);
      if (parsed.size > 0) return { traffic: parsed, trafficError: null };
      lastError = 'Shopify returned no session rows for this store.';
    } catch (error) {
      lastError =
        error instanceof ShopifyApiError && error.isAuthError
          ? 'Sessions need the read_reports permission on the Shopify app.'
          : error instanceof Error
            ? error.message
            : lastError;
    }
  }
  return { traffic: null, trafficError: lastError.slice(0, 1000) };
}

async function tryBreakdown(shopDomain: string, token: string, dimension: string): Promise<ShopifyqlTable | null> {
  const queries = [
    `FROM sessions SHOW sessions, sessions_with_cart_additions GROUP BY ${dimension} SINCE -${TRAFFIC_BREAKDOWN_DAYS}d UNTIL today ORDER BY sessions DESC LIMIT 10`,
    `FROM sessions SHOW sessions GROUP BY ${dimension} SINCE -${TRAFFIC_BREAKDOWN_DAYS}d UNTIL today ORDER BY sessions DESC LIMIT 10`,
  ];
  for (const query of queries) {
    try {
      return await runShopifyql(shopDomain, token, query);
    } catch {
      // try the next spelling
    }
  }
  return null;
}

async function saveTrafficSnapshot(
  store: SocialShopifyStore,
  token: string,
  today: string,
  buckets: Map<string, { orders: number }>
) {
  const periodStart = shiftDay(today, -(TRAFFIC_BREAKDOWN_DAYS - 1));
  const rows = await prisma.shopifyDailyMetric.findMany({
    where: { storeId: store.id, date: { gte: dayToDate(periodStart), lte: dayToDate(today) } },
  });
  const sessions = rows.reduce((sum, r) => sum + (r.sessions ?? 0), 0);
  const addToCart = rows.reduce((sum, r) => sum + (r.addToCart ?? 0), 0);
  let orders = 0;
  for (const day of daysBetween(periodStart, today)) orders += buckets.get(day)?.orders ?? 0;

  const [landing, sources, devices] = await Promise.all([
    tryBreakdown(store.shopDomain, token, 'landing_page_path'),
    tryBreakdown(store.shopDomain, token, 'referrer_source'),
    tryBreakdown(store.shopDomain, token, 'session_device_type'),
  ]);

  await prisma.shopifyTrafficSnapshot.create({
    data: {
      storeId: store.id,
      organizationId: store.organizationId,
      customerId: store.customerId,
      periodStart: dayToDate(periodStart),
      periodEnd: dayToDate(today),
      sessions,
      addToCart,
      orders,
      landing: landing ? parseBreakdown(landing, [/landing/i, /page/i]) : [],
      sources: sources ? parseBreakdown(sources, [/referrer/i, /source/i]) : [],
      devices: devices ? parseBreakdown(devices, [/device/i]) : [],
      note: null,
    },
  });
  // Keep the last 30 snapshots per store.
  const old = await prisma.shopifyTrafficSnapshot.findMany({
    where: { storeId: store.id },
    orderBy: { createdAt: 'desc' },
    skip: 30,
    select: { id: true },
  });
  if (old.length) await prisma.shopifyTrafficSnapshot.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });
}

async function requireStore(organizationId: string, customerId: string): Promise<SocialShopifyStore> {
  const store = await prisma.socialShopifyStore.findFirst({ where: { organizationId, customerId } });
  if (!store) throw new HttpError(404, 'Connect the Shopify store first.');
  return store;
}

async function removeOurWebhooks(shopDomain: string, token: string, callbackUrl: string): Promise<void> {
  const existing = await listWebhooks(shopDomain, token);
  const ours = existing.filter((sub) => sub.callbackUrl && urlsMatch(sub.callbackUrl, callbackUrl));
  for (const sub of ours) {
    try {
      await deleteWebhook(shopDomain, token, sub.id);
    } catch (error) {
      console.error(`[growth] Failed to delete Shopify webhook ${sub.id}:`, error);
    }
  }
}

function urlsMatch(a: string, b: string): boolean {
  try {
    const left = new URL(a);
    const right = new URL(b);
    return left.origin === right.origin && left.pathname.replace(/\/$/, '') === right.pathname.replace(/\/$/, '');
  } catch {
    return a.replace(/\/$/, '') === b.replace(/\/$/, '');
  }
}

