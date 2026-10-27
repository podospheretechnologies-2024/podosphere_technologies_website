import 'server-only';
import { decrypt, encrypt } from '@/shared/lib/crypto';
import { getServerEnv } from '@/shared/lib/env';
import { prisma } from '@/shared/lib/prisma';
import { scopeWhere, type ClientScope } from '@/shared/server/client-scope';
import { HttpError } from '@/shared/server/http-error';
import type {
  AdsAdItem,
  AdsAdSetItem,
  AdsCampaignItem,
  AdsDailyPoint,
  AdsTotals,
} from '../../types/ads';
import type {
  GoogleAdsAccountItem,
  GoogleAdsOverview,
  GoogleAdsStatusResponse,
} from '../../types/google-ads';
import type { AdsOverviewDateQuery } from '../ads/ads.schema';
import { googleAdsOAuthState } from './google-ads-oauth-state';

// Read-only: nothing here creates, edits or pauses Google Ads entities.
// Access level is per Google Cloud project (developer tokens were sunset 9 Sep 2026), so
// GOOGLE_ADS_DEVELOPER_TOKEN is optional and only sent when set. The OAuth client is
// GOOGLE_ADS_CLIENT_* when set, else the shared GOOGLE_CLIENT_*. See docs/GOOGLE_ADS_SETUP.md.

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';
const ADS_BASE = 'https://googleads.googleapis.com';
const DEFAULT_API_VERSION = 'v24';
const ROW_LIMIT = 500;

const SCOPES = ['openid', 'email', 'profile', 'https://www.googleapis.com/auth/adwords'] as const;

const DATE_PRESET_DAYS: Record<string, number> = { last_7d: 7, last_30d: 30, last_90d: 90 };

interface Metrics {
  costMicros?: string | number;
  impressions?: string | number;
  clicks?: string | number;
  ctr?: number;
  averageCpc?: string | number;
  conversions?: number;
}

interface GaqlCustomer {
  id?: string;
  descriptiveName?: string;
  currencyCode?: string;
  timeZone?: string;
  manager?: boolean;
  status?: string;
}

interface GaqlRow {
  customer?: GaqlCustomer;
  customerClient?: GaqlCustomer;
  campaign?: { id?: string; name?: string; status?: string; advertisingChannelType?: string };
  campaignBudget?: { amountMicros?: string | number };
  adGroup?: { id?: string; name?: string; status?: string };
  adGroupAd?: {
    status?: string;
    ad?: {
      id?: string;
      name?: string;
      responsiveSearchAd?: { headlines?: { text?: string }[]; descriptions?: { text?: string }[] };
    };
  };
  segments?: { date?: string };
  metrics?: Metrics;
}

type ConnectionRow = NonNullable<Awaited<ReturnType<typeof findConnection>>>;

function findConnection(organizationId: string) {
  return prisma.socialGoogleAdsConnection.findUnique({ where: { organizationId } });
}

// Prefers the Ads-only OAuth client so the Google Ads access level can live on its own Cloud
// project; falls back to the Google client shared with Sheets, YouTube and Business Profile.
function oauthClient(): { clientId?: string; clientSecret?: string } {
  const env = getServerEnv();
  // Fall back as a pair, never field by field: an id from one Cloud project with a secret from
  // another passes isConfigured() and then dies at token exchange with an opaque invalid_client.
  // Half a GOOGLE_ADS_* pair is reported as missing instead.
  if (env.GOOGLE_ADS_CLIENT_ID || env.GOOGLE_ADS_CLIENT_SECRET) {
    return { clientId: env.GOOGLE_ADS_CLIENT_ID, clientSecret: env.GOOGLE_ADS_CLIENT_SECRET };
  }
  return { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET };
}

function missingEnv(): string[] {
  const { clientId, clientSecret } = oauthClient();
  const missing: string[] = [];
  if (!clientId) missing.push('GOOGLE_ADS_CLIENT_ID');
  if (!clientSecret) missing.push('GOOGLE_ADS_CLIENT_SECRET');
  return missing;
}

function requireConfigured() {
  const missing = missingEnv();
  if (missing.length > 0) {
    throw new HttpError(400, `Google Ads is not configured. Set ${missing.join(', ')} in .env.`);
  }
  const env = getServerEnv();
  const { clientId, clientSecret } = oauthClient();
  return {
    clientId: clientId!,
    clientSecret: clientSecret!,
    developerToken: env.GOOGLE_ADS_DEVELOPER_TOKEN || undefined,
    defaultLoginCustomerId: env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || undefined,
    version: env.GOOGLE_ADS_API_VERSION || DEFAULT_API_VERSION,
  };
}

function redirectUri(): string {
  return new URL('/api/social/ads/google/callback', getServerEnv().APP_URL).toString();
}

const num = (value: string | number | undefined) =>
  value === undefined || value === '' ? 0 : Number(value);

async function tokenRequest(body: URLSearchParams, failure: string) {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!response.ok) throw new HttpError(401, failure);
  return (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  };
}

async function getValidAccessToken(connection: ConnectionRow): Promise<string> {
  const expiresSoon =
    connection.tokenExpiration && connection.tokenExpiration.getTime() < Date.now() + 60_000;
  if (!expiresSoon) return decrypt(connection.accessToken);

  if (!connection.refreshToken) {
    throw new HttpError(401, 'Google session expired. Please connect Google Ads again.');
  }
  const { clientId, clientSecret } = requireConfigured();
  const refreshed = await tokenRequest(
    new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: decrypt(connection.refreshToken),
      grant_type: 'refresh_token',
    }),
    'Google session expired. Please connect Google Ads again.'
  );
  await prisma.socialGoogleAdsConnection.update({
    where: { id: connection.id },
    data: {
      accessToken: encrypt(refreshed.access_token),
      tokenExpiration: refreshed.expires_in
        ? new Date(Date.now() + refreshed.expires_in * 1000)
        : null,
    },
  });
  return refreshed.access_token;
}

interface GoogleErrorBody {
  error?: {
    message?: string;
    status?: string;
    details?: { errors?: { message?: string }[] }[];
  };
}

async function adsRequest<T>(
  path: string,
  accessToken: string,
  loginCustomerId: string | undefined,
  init: RequestInit = {}
): Promise<T> {
  const { developerToken, version } = requireConfigured();
  const response = await fetch(`${ADS_BASE}/${version}/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(developerToken ? { 'developer-token': developerToken } : {}),
      'Content-Type': 'application/json',
      ...(loginCustomerId ? { 'login-customer-id': loginCustomerId } : {}),
    },
  });
  if (!response.ok) {
    const parsed = (await response.json().catch(() => null)) as
      | GoogleErrorBody
      | GoogleErrorBody[]
      | null;
    const body = Array.isArray(parsed) ? parsed[0] : parsed;
    const detail =
      body?.error?.details?.[0]?.errors?.[0]?.message ?? body?.error?.message ?? response.statusText;
    if (response.status === 401) {
      throw new HttpError(401, 'Google session expired. Please connect Google Ads again.');
    }
    if (response.status === 429) {
      throw new HttpError(429, 'Google Ads rate limit reached. Try again in a few minutes.');
    }
    throw new HttpError(response.status === 403 ? 403 : 502, `Google Ads: ${detail}`);
  }
  return (await response.json()) as T;
}

async function gaql(
  customerId: string,
  accessToken: string,
  loginCustomerId: string | undefined,
  query: string
): Promise<GaqlRow[]> {
  const batches = await adsRequest<{ results?: GaqlRow[] }[]>(
    `customers/${customerId}/googleAds:searchStream`,
    accessToken,
    loginCustomerId,
    { method: 'POST', body: JSON.stringify({ query }) }
  );
  return batches.flatMap((batch) => batch.results ?? []);
}

function toTotals(metrics: Metrics | undefined): AdsTotals {
  const spend = num(metrics?.costMicros) / 1_000_000;
  const conversions = num(metrics?.conversions);
  return {
    spend,
    impressions: num(metrics?.impressions),
    reach: 0,
    clicks: num(metrics?.clicks),
    ctr: num(metrics?.ctr) * 100,
    cpc: num(metrics?.averageCpc) / 1_000_000,
    leads: Math.round(conversions * 100) / 100,
    costPerLead: conversions > 0 ? spend / conversions : null,
  };
}

function normalizeStatus(status: string | undefined): string {
  if (status === 'ENABLED') return 'ACTIVE';
  return status ?? 'UNKNOWN';
}

function dateInZone(date: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

function resolveRange(date: AdsOverviewDateQuery, timeZone: string): { since: string; until: string } {
  if (date.mode === 'range') return { since: date.since, until: date.until };
  const days = DATE_PRESET_DAYS[date.datePreset] ?? 30;
  const now = Date.now();
  return {
    since: dateInZone(new Date(now - (days - 1) * 86_400_000), timeZone),
    until: dateInZone(new Date(now), timeZone),
  };
}

function formatBudget(amount: number, currency: string): string {
  const formatted = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
  return `${formatted} Daily`;
}

function toAccountItem(row: {
  googleCustomerId: string;
  name: string;
  currency: string;
  timeZone: string;
  status: string;
  customerId: string | null;
}): GoogleAdsAccountItem {
  return {
    id: row.googleCustomerId,
    name: row.name,
    currency: row.currency,
    timeZone: row.timeZone,
    status: row.status,
    clientId: row.customerId,
  };
}

interface DiscoveredAccount {
  googleCustomerId: string;
  name: string;
  currency: string;
  timeZone: string;
  status: string;
  loginCustomerId: string | null;
}

/** Lists accessible customers, expanding manager accounts into their client accounts. */
async function discoverAccounts(accessToken: string): Promise<DiscoveredAccount[]> {
  const { defaultLoginCustomerId } = requireConfigured();
  const listed = await adsRequest<{ resourceNames?: string[] }>(
    'customers:listAccessibleCustomers',
    accessToken,
    undefined
  );
  const ids = (listed.resourceNames ?? []).map((name) => name.replace('customers/', ''));
  const found = new Map<string, DiscoveredAccount>();
  const managers: string[] = [];

  for (const id of ids) {
    try {
      const [row] = await gaql(
        id,
        accessToken,
        defaultLoginCustomerId,
        'SELECT customer.id, customer.descriptive_name, customer.currency_code, customer.time_zone, customer.manager, customer.status FROM customer LIMIT 1'
      );
      const customer = row?.customer;
      if (!customer) continue;
      if (customer.manager) {
        managers.push(id);
        continue;
      }
      found.set(id, {
        googleCustomerId: id,
        name: customer.descriptiveName || id,
        currency: customer.currencyCode ?? 'USD',
        timeZone: customer.timeZone ?? 'UTC',
        status: customer.status ?? 'UNKNOWN',
        loginCustomerId: defaultLoginCustomerId ?? null,
      });
    } catch {
      // Not every accessible customer is queryable (cancelled, no permission); skip it.
    }
  }

  for (const managerId of managers) {
    try {
      const rows = await gaql(
        managerId,
        accessToken,
        managerId,
        "SELECT customer_client.id, customer_client.descriptive_name, customer_client.currency_code, customer_client.time_zone, customer_client.status, customer_client.manager FROM customer_client WHERE customer_client.manager = false AND customer_client.status != 'CANCELED'"
      );
      for (const row of rows) {
        const client = row.customerClient;
        if (!client?.id) continue;
        found.set(client.id, {
          googleCustomerId: client.id,
          name: client.descriptiveName || client.id,
          currency: client.currencyCode ?? 'USD',
          timeZone: client.timeZone ?? 'UTC',
          status: client.status ?? 'UNKNOWN',
          loginCustomerId: managerId,
        });
      }
    } catch {
      // Manager not readable with this login; its clients are skipped.
    }
  }

  return [...found.values()];
}

async function syncAccounts(connection: ConnectionRow, accessToken: string) {
  try {
    const accounts = await discoverAccounts(accessToken);
    for (const account of accounts) {
      await prisma.socialGoogleAdsAccount.upsert({
        where: {
          connectionId_googleCustomerId: {
            connectionId: connection.id,
            googleCustomerId: account.googleCustomerId,
          },
        },
        update: {
          name: account.name,
          currency: account.currency,
          timeZone: account.timeZone,
          status: account.status,
          loginCustomerId: account.loginCustomerId,
        },
        create: {
          organizationId: connection.organizationId,
          connectionId: connection.id,
          ...account,
        },
      });
    }
    await prisma.socialGoogleAdsAccount.deleteMany({
      where: {
        connectionId: connection.id,
        googleCustomerId: { notIn: accounts.map((account) => account.googleCustomerId) },
      },
    });
    await prisma.socialGoogleAdsConnection.update({
      where: { id: connection.id },
      data: { lastSyncedAt: new Date(), lastError: null },
    });
  } catch (error) {
    const message = error instanceof HttpError ? error.message : 'Could not list Google Ads accounts';
    await prisma.socialGoogleAdsConnection.update({
      where: { id: connection.id },
      data: { lastError: message.slice(0, 500) },
    });
  }
}

export const googleAdsService = {
  isConfigured: () => missingEnv().length === 0,

  async getConnectUrl(organizationId: string): Promise<{ url: string }> {
    const { clientId } = requireConfigured();
    const state = await googleAdsOAuthState.save(organizationId);
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri(),
      response_type: 'code',
      scope: SCOPES.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      state,
    });
    return { url: `${AUTH_URL}?${params}` };
  },

  async completeConnect(organizationId: string, code: string, state: string) {
    const savedOrg = await googleAdsOAuthState.consume(state);
    if (!savedOrg || savedOrg !== organizationId) {
      throw new HttpError(400, 'Invalid or expired Google authorization state');
    }
    const { clientId, clientSecret } = requireConfigured();
    const token = await tokenRequest(
      new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri(),
        grant_type: 'authorization_code',
      }),
      'Could not exchange Google authorization code'
    );
    if (!token.scope?.includes('auth/adwords')) {
      throw new HttpError(
        400,
        'Google Ads access was not granted. Allow the Google Ads permission and try again.'
      );
    }

    const profileResponse = await fetch(USERINFO_URL, {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    const user = (await profileResponse.json().catch(() => ({}))) as {
      email?: string;
      name?: string;
      picture?: string;
    };
    if (!user.email) throw new HttpError(400, 'Google did not return an email for this account');

    const existing = await findConnection(organizationId);
    const data = {
      email: user.email,
      name: user.name ?? null,
      picture: user.picture ?? null,
      accessToken: encrypt(token.access_token),
      refreshToken: token.refresh_token
        ? encrypt(token.refresh_token)
        : (existing?.refreshToken ?? null),
      tokenExpiration: token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : null,
      scopes: token.scope ?? SCOPES.join(' '),
    };
    const connection = await prisma.socialGoogleAdsConnection.upsert({
      where: { organizationId },
      create: { organizationId, ...data },
      update: data,
    });
    await syncAccounts(connection, token.access_token);
  },

  async getStatus(scope: ClientScope): Promise<GoogleAdsStatusResponse> {
    const missing = missingEnv();
    const connection = await findConnection(scope.organizationId);
    if (!connection) {
      return {
        connection: { connected: false, configured: missing.length === 0, missing },
        accounts: [],
      };
    }
    const accounts = await prisma.socialGoogleAdsAccount.findMany({
      where: scopeWhere(scope),
      orderBy: { name: 'asc' },
    });
    return {
      connection: {
        connected: true,
        configured: missing.length === 0,
        missing,
        email: connection.email,
        name: connection.name,
        picture: connection.picture,
        lastSyncedAt: connection.lastSyncedAt?.toISOString() ?? null,
        lastError: connection.lastError,
      },
      accounts: accounts.map(toAccountItem),
    };
  },

  async refresh(organizationId: string) {
    const connection = await findConnection(organizationId);
    if (!connection) throw new HttpError(404, 'Google Ads is not connected');
    await syncAccounts(connection, await getValidAccessToken(connection));
  },

  async disconnect(organizationId: string) {
    await prisma.socialGoogleAdsConnection.deleteMany({ where: { organizationId } });
  },

  async assignAccount(organizationId: string, googleCustomerId: string, clientId: string | null) {
    if (clientId) {
      const client = await prisma.socialCustomer.findFirst({
        where: { id: clientId, organizationId },
        select: { id: true },
      });
      if (!client) throw new HttpError(404, 'Client not found');
    }
    const result = await prisma.socialGoogleAdsAccount.updateMany({
      where: { organizationId, googleCustomerId },
      data: { customerId: clientId },
    });
    if (result.count === 0) throw new HttpError(404, 'Google Ads account not found');
  },

  async overview(
    scope: ClientScope,
    googleCustomerId: string,
    date: AdsOverviewDateQuery
  ): Promise<GoogleAdsOverview> {
    const row = await prisma.socialGoogleAdsAccount.findFirst({
      where: { googleCustomerId, ...scopeWhere(scope) },
      include: { connection: true },
    });
    if (!row) throw new HttpError(404, 'Google Ads account not found');

    const accessToken = await getValidAccessToken(row.connection);
    const login = row.loginCustomerId ?? undefined;
    const { since, until } = resolveRange(date, row.timeZone);
    const during = `segments.date BETWEEN '${since}' AND '${until}'`;
    const metricFields =
      'metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.ctr, metrics.average_cpc, metrics.conversions';
    const run = (query: string) => gaql(googleCustomerId, accessToken, login, query);

    const [totalsRows, dailyRows, campaignRows, adGroupRows, adRows] = await Promise.all([
      run(`SELECT ${metricFields} FROM customer WHERE ${during}`),
      run(
        `SELECT segments.date, metrics.cost_micros, metrics.clicks FROM customer WHERE ${during} ORDER BY segments.date`
      ),
      run(
        `SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type, campaign_budget.amount_micros, ${metricFields} FROM campaign WHERE ${during} AND campaign.status != 'REMOVED' ORDER BY metrics.cost_micros DESC LIMIT ${ROW_LIMIT}`
      ),
      run(
        `SELECT ad_group.id, ad_group.name, ad_group.status, campaign.id, campaign.name, ${metricFields} FROM ad_group WHERE ${during} AND ad_group.status != 'REMOVED' ORDER BY metrics.cost_micros DESC LIMIT ${ROW_LIMIT}`
      ),
      run(
        `SELECT ad_group_ad.ad.id, ad_group_ad.ad.name, ad_group_ad.status, ad_group_ad.ad.responsive_search_ad.headlines, ad_group_ad.ad.responsive_search_ad.descriptions, ad_group.id, ad_group.name, campaign.id, campaign.name, ${metricFields} FROM ad_group_ad WHERE ${during} AND ad_group_ad.status != 'REMOVED' ORDER BY metrics.cost_micros DESC LIMIT ${ROW_LIMIT}`
      ),
    ]);

    const daily: AdsDailyPoint[] = dailyRows.map((r) => ({
      date: r.segments?.date ?? '',
      spend: num(r.metrics?.costMicros) / 1_000_000,
      clicks: num(r.metrics?.clicks),
    }));

    const byActiveThenSpend = <T extends { status: string; spend: number }>(a: T, b: T) =>
      Number(b.status === 'ACTIVE') - Number(a.status === 'ACTIVE') || b.spend - a.spend;

    const campaigns: AdsCampaignItem[] = campaignRows
      .map((r) => {
        const stats = toTotals(r.metrics);
        const budgetAmount = r.campaignBudget?.amountMicros
          ? num(r.campaignBudget.amountMicros) / 1_000_000
          : null;
        return {
          id: r.campaign?.id ?? '',
          name: r.campaign?.name ?? '(unnamed)',
          status: normalizeStatus(r.campaign?.status),
          objective: r.campaign?.advertisingChannelType ?? 'UNKNOWN',
          budgetAmount,
          budgetType: budgetAmount === null ? null : ('daily' as const),
          budgetLabel: budgetAmount === null ? null : formatBudget(budgetAmount, row.currency),
          spend: stats.spend,
          impressions: stats.impressions,
          clicks: stats.clicks,
          ctr: stats.ctr,
          cpc: stats.cpc,
          leads: stats.leads,
          costPerLead: stats.costPerLead,
          landingPageViews: 0,
          reach: stats.reach || null,
          frequency: null,
          cpm: null,
          linkClicks: stats.clicks || null,
          startsAt: null,
          endsAt: null,
          attributionLabel: null,
          bidStrategyLabel: null,
          recommendations: 0,
        };
      })
      .sort(byActiveThenSpend);

    const adGroups: AdsAdSetItem[] = adGroupRows
      .map((r) => {
        const stats = toTotals(r.metrics);
        return {
          id: r.adGroup?.id ?? '',
          name: r.adGroup?.name ?? '(unnamed)',
          status: normalizeStatus(r.adGroup?.status),
          campaignId: r.campaign?.id ?? null,
          campaignName: r.campaign?.name ?? null,
          targeting: { ageMin: null, ageMax: null, locations: [], interests: [], behaviors: [] },
          spend: stats.spend,
          impressions: stats.impressions,
          clicks: stats.clicks,
          reach: stats.reach || null,
          frequency: null,
          cpm: null,
          ctr: stats.ctr,
          cpc: stats.cpc,
          leads: stats.leads,
          costPerLead: stats.costPerLead,
          startsAt: null,
          endsAt: null,
          attributionLabel: null,
          bidStrategyLabel: null,
          recommendations: 0,
        };
      })
      .sort(byActiveThenSpend);

    const ads: AdsAdItem[] = adRows
      .map((r) => {
        const stats = toTotals(r.metrics);
        const rsa = r.adGroupAd?.ad?.responsiveSearchAd;
        const headline = rsa?.headlines?.[0]?.text ?? null;
        const id = r.adGroupAd?.ad?.id ?? '';
        return {
          id,
          name: r.adGroupAd?.ad?.name || headline || `Ad ${id}`,
          status: normalizeStatus(r.adGroupAd?.status),
          campaignId: r.campaign?.id ?? null,
          campaignName: r.campaign?.name ?? null,
          adsetId: r.adGroup?.id ?? null,
          adsetName: r.adGroup?.name ?? null,
          thumbnailUrl: null,
          primaryText: rsa?.descriptions?.[0]?.text ?? null,
          headline,
          description: rsa?.descriptions?.[1]?.text ?? null,
          spend: stats.spend,
          impressions: stats.impressions,
          clicks: stats.clicks,
          ctr: stats.ctr,
          cpc: stats.cpc,
          leads: stats.leads,
          costPerLead: stats.costPerLead,
          reach: stats.reach || null,
          frequency: null,
          cpm: null,
          linkClicks: stats.clicks || null,
          startsAt: null,
          endsAt: null,
          attributionLabel: null,
          bidStrategyLabel: null,
          recommendations: 0,
        };
      })
      .sort(byActiveThenSpend);

    return {
      account: toAccountItem(row),
      since,
      until,
      totals: toTotals(totalsRows[0]?.metrics),
      daily,
      campaigns,
      adGroups,
      ads,
    };
  },
};
