import 'server-only';
import { prisma } from '@/shared/lib/prisma';
import { decrypt, encrypt } from '@/shared/lib/crypto';
import { HttpError } from '@/shared/server/http-error';
import type { SocialShopifyStore } from '@/generated/prisma/client';
import {
  ShopifyApiError,
  exchangeClientCredentials,
  fetchGrantedScopes,
  fetchOrdersSince,
  fetchShopInfo,
  normalizeShopDomain,
  runShopifyql,
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

export const RECOMMENDED_SCOPES = ['read_orders', 'read_reports', 'read_content', 'write_content'] as const;

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
  status: string | null;
  lastError: string | null;
  lastSyncedAt: string | null;
  trafficAvailable: boolean | null;
  trafficError: string | null;
}

function toDto(store: SocialShopifyStore | null): ShopifyStoreDto {
  const scopes = store?.scopes ? store.scopes.split(',').map((s) => s.trim()).filter(Boolean) : [];
  return {
    connected: Boolean(store),
    shopDomain: store?.shopDomain ?? null,
    shopName: store?.shopName ?? null,
    primaryUrl: store?.primaryUrl ?? null,
    currency: store?.currency ?? null,
    timeZone: store?.timeZone ?? null,
    authMode: store?.authMode ?? null,
    scopes,
    missingScopes: store ? RECOMMENDED_SCOPES.filter((s) => !scopes.includes(s)) : [],
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
    await prisma.socialShopifyStore.deleteMany({ where: { organizationId, customerId } });
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
