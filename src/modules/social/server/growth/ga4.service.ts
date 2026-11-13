import 'server-only';
import { decrypt, encrypt, randomToken } from '@/shared/lib/crypto';
import { getServerEnv } from '@/shared/lib/env';
import { prisma } from '@/shared/lib/prisma';
import { redis } from '@/shared/lib/redis';
import { HttpError } from '@/shared/server/http-error';
import type { Prisma, SocialGa4Connection, SocialGa4Property } from '@/generated/prisma/client';
import {
  DAILY_METRICS,
  GA4_SCOPE,
  Ga4ApiError,
  batchRunReports,
  breakdownRequest,
  getPropertyDetails,
  listProperties,
  parseBreakdownReport,
  parseDailyReport,
  parseTotalsReport,
  runReport,
  type Ga4BreakdownRow,
  type Ga4Totals,
} from './ga4.client';
import { dayToDate, localDay, shiftDay } from './growth-metrics';

// Google Analytics 4, connected like Meta / Google Ads: one Google login per organization
// (analytics.readonly), every property it can read is listed, each property is assigned to one
// client. The login only needs Viewer on a property. Uses GOOGLE_GA4_CLIENT_ID / SECRET when set,
// otherwise the shared GOOGLE_CLIENT_ID / SECRET.

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';
const SCOPES = ['openid', 'email', 'profile', GA4_SCOPE] as const;
const STATE_PREFIX = 'social:ga4-oauth:';
const STATE_TTL_SECONDS = 60 * 60;

/** Days of daily rows kept fresh on every sync (GA4 keeps reprocessing the last ~3 days). */
const DAILY_DAYS = 90;
const BREAKDOWN_DAYS = 30;

export const GA4_CALLBACK_PATH = '/api/social/growth/ga4/callback';

// ---------- DTOs ----------

export interface Ga4PropertyDto {
  propertyId: string;
  displayName: string;
  accountName: string | null;
  currency: string | null;
  timeZone: string | null;
  status: string;
  lastError: string | null;
  lastSyncedAt: string | null;
}

export interface Ga4StatusDto {
  /** GOOGLE_GA4_CLIENT_* (or the shared GOOGLE_CLIENT_*) pair is set on the server. */
  configured: boolean;
  /** The organization has a Google login connected for Analytics. */
  connected: boolean;
  googleEmail: string | null;
  connectionError: string | null;
  /** Only owners / admins may connect or disconnect the Google login. */
  canConnect: boolean;
  /** Property assigned to the selected client. */
  property: Ga4PropertyDto | null;
  /** Properties this user may pick for the client: unassigned ones (only for reviewers). */
  available: { propertyId: string; displayName: string; accountName: string | null }[];
  redirectUri: string;
}

export interface Ga4WebsiteDto {
  property: Ga4PropertyDto | null;
  snapshot: {
    periodStart: string;
    periodEnd: string;
    totals: Ga4Totals;
    channels: Ga4BreakdownRow[];
    sources: Ga4BreakdownRow[];
    landing: Ga4BreakdownRow[];
    devices: Ga4BreakdownRow[];
    updatedAt: string;
  } | null;
}

function toPropertyDto(row: SocialGa4Property): Ga4PropertyDto {
  return {
    propertyId: row.propertyId,
    displayName: row.displayName,
    accountName: row.accountName,
    currency: row.currency,
    timeZone: row.timeZone,
    status: row.status,
    lastError: row.lastError,
    lastSyncedAt: row.lastSyncedAt?.toISOString() ?? null,
  };
}

// ---------- OAuth ----------

// Prefers the GA4-only OAuth client (company Cloud project, Internal consent screen, so the
// login never expires after 7 days); falls back to the client shared with Sheets / YouTube / GBP.
function oauthClient(): { clientId?: string; clientSecret?: string } {
  const env = getServerEnv();
  // Fall back as a pair, never field by field: an id from one Cloud project with a secret from
  // another passes isConfigured() and then dies at token exchange with an opaque invalid_client.
  if (env.GOOGLE_GA4_CLIENT_ID || env.GOOGLE_GA4_CLIENT_SECRET) {
    return { clientId: env.GOOGLE_GA4_CLIENT_ID, clientSecret: env.GOOGLE_GA4_CLIENT_SECRET };
  }
  return { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET };
}

function isConfigured() {
  const { clientId, clientSecret } = oauthClient();
  return Boolean(clientId && clientSecret);
}

function requireConfigured() {
  const { clientId, clientSecret } = oauthClient();
  if (!clientId || !clientSecret) {
    throw new HttpError(
      400,
      'Google Analytics is not configured. Set GOOGLE_GA4_CLIENT_ID and GOOGLE_GA4_CLIENT_SECRET (or GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET) in .env.'
    );
  }
  return { clientId, clientSecret };
}

export function ga4RedirectUri(): string {
  return new URL(GA4_CALLBACK_PATH, getServerEnv().APP_URL).toString();
}

async function tokenRequest(body: URLSearchParams, failure: string) {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!response.ok) throw new HttpError(401, failure);
  return (await response.json()) as { access_token: string; refresh_token?: string; expires_in?: number; scope?: string };
}

async function accessTokenFor(connection: SocialGa4Connection): Promise<string> {
  const expiresSoon = connection.tokenExpiration && connection.tokenExpiration.getTime() < Date.now() + 60_000;
  if (!expiresSoon) return decrypt(connection.accessToken);
  if (!connection.refreshToken) throw new Ga4ApiError('Google session expired. Connect Google Analytics again.', 401);
  const { clientId, clientSecret } = requireConfigured();
  const fresh = await tokenRequest(
    new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: decrypt(connection.refreshToken),
      grant_type: 'refresh_token',
    }),
    'Google session expired. Connect Google Analytics again.'
  );
  await prisma.socialGa4Connection.update({
    where: { id: connection.id },
    data: {
      accessToken: encrypt(fresh.access_token),
      tokenExpiration: fresh.expires_in ? new Date(Date.now() + fresh.expires_in * 1000) : null,
    },
  });
  return fresh.access_token;
}

/** Re-lists the properties the login can read. Assignments survive; vanished properties are removed. */
async function discoverProperties(connection: SocialGa4Connection): Promise<void> {
  try {
    const properties = await listProperties(await accessTokenFor(connection));
    for (const p of properties) {
      await prisma.socialGa4Property.upsert({
        where: { organizationId_propertyId: { organizationId: connection.organizationId, propertyId: p.propertyId } },
        update: { displayName: p.displayName, accountName: p.accountName },
        create: { organizationId: connection.organizationId, ...p },
      });
    }
    await prisma.socialGa4Property.deleteMany({
      where: { organizationId: connection.organizationId, propertyId: { notIn: properties.map((p) => p.propertyId) } },
    });
    await prisma.socialGa4Connection.update({
      where: { id: connection.id },
      data: {
        lastSyncedAt: new Date(),
        lastError: properties.length ? null : 'This Google login cannot see any GA4 property. Add it as Viewer on the client property, then press Refresh list.',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not list Google Analytics properties';
    await prisma.socialGa4Connection.update({ where: { id: connection.id }, data: { lastError: message.slice(0, 1000) } });
  }
}

// ---------- service ----------

export const ga4Service = {
  isConfigured,

  async getConnectUrl(organizationId: string): Promise<{ url: string }> {
    const { clientId } = requireConfigured();
    const state = randomToken(24);
    await redis.set(`${STATE_PREFIX}${state}`, organizationId, 'EX', STATE_TTL_SECONDS);
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: ga4RedirectUri(),
      response_type: 'code',
      scope: SCOPES.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
      state,
    });
    return { url: `${AUTH_URL}?${params}` };
  },

  async completeConnect(organizationId: string, code: string, state: string): Promise<void> {
    const savedOrg = await redis.getdel(`${STATE_PREFIX}${state}`);
    if (!savedOrg || savedOrg !== organizationId) throw new HttpError(400, 'Invalid or expired Google authorization state');
    const { clientId, clientSecret } = requireConfigured();
    const token = await tokenRequest(
      new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: ga4RedirectUri(), grant_type: 'authorization_code' }),
      'Could not exchange the Google authorization code'
    );
    if (!token.scope?.includes(GA4_SCOPE)) {
      throw new HttpError(400, 'Google Analytics access was not granted. Tick the Analytics permission and try again.');
    }
    const profile = (await fetch(USERINFO_URL, { headers: { Authorization: `Bearer ${token.access_token}` } })
      .then((r) => r.json())
      .catch(() => ({}))) as { email?: string; name?: string };
    if (!profile.email) throw new HttpError(400, 'Google did not return an email for this account');

    const existing = await prisma.socialGa4Connection.findUnique({ where: { organizationId } });
    const data = {
      email: profile.email,
      name: profile.name ?? null,
      accessToken: encrypt(token.access_token),
      refreshToken: token.refresh_token ? encrypt(token.refresh_token) : (existing?.refreshToken ?? null),
      tokenExpiration: token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : null,
      scopes: token.scope,
      lastError: null,
    };
    const connection = await prisma.socialGa4Connection.upsert({
      where: { organizationId },
      create: { organizationId, ...data },
      update: data,
    });
    await discoverProperties(connection);
  },

  async refreshProperties(organizationId: string): Promise<void> {
    const connection = await prisma.socialGa4Connection.findUnique({ where: { organizationId } });
    if (!connection) throw new HttpError(400, 'Connect Google Analytics first.');
    await discoverProperties(connection);
  },

  /** Removes the Google login and the property list. Synced numbers stay. */
  async disconnect(organizationId: string): Promise<void> {
    await prisma.$transaction([
      prisma.socialGa4Property.deleteMany({ where: { organizationId } }),
      prisma.socialGa4Connection.deleteMany({ where: { organizationId } }),
    ]);
  },

  async getStatus(
    organizationId: string,
    customerId: string,
    opts: { canReview: boolean; canConnect: boolean }
  ): Promise<Ga4StatusDto> {
    const [connection, property, available] = await Promise.all([
      prisma.socialGa4Connection.findUnique({ where: { organizationId } }),
      prisma.socialGa4Property.findFirst({ where: { organizationId, customerId } }),
      opts.canReview
        ? prisma.socialGa4Property.findMany({
            where: { organizationId, customerId: null },
            orderBy: [{ accountName: 'asc' }, { displayName: 'asc' }],
            select: { propertyId: true, displayName: true, accountName: true },
            take: 500,
          })
        : Promise.resolve([]),
    ]);
    return {
      configured: isConfigured(),
      connected: Boolean(connection),
      googleEmail: connection?.email ?? null,
      connectionError: connection?.lastError ?? null,
      canConnect: opts.canConnect,
      property: property ? toPropertyDto(property) : null,
      available,
      redirectUri: ga4RedirectUri(),
    };
  },

  /**
   * Assigns a property to the client (or clears it with null). A property already used by another
   * client is refused, so a reviewer of one client can never take another client's numbers.
   * Returns the property row id to sync, if any.
   */
  async assign(organizationId: string, customerId: string, propertyId: string | null): Promise<string | null> {
    const current = await prisma.socialGa4Property.findFirst({ where: { organizationId, customerId } });
    if (!propertyId) {
      if (current) {
        await prisma.$transaction([
          prisma.socialGa4Property.update({ where: { id: current.id }, data: { customerId: null } }),
          ...dropSyncedData(organizationId, current.propertyId),
        ]);
      }
      return null;
    }
    const target = await prisma.socialGa4Property.findFirst({ where: { organizationId, propertyId } });
    if (!target) throw new HttpError(404, 'Property not found. Press Refresh list.');
    if (target.customerId && target.customerId !== customerId) {
      throw new HttpError(409, 'This property is already assigned to another client.');
    }
    if (target.customerId === customerId) return target.id;
    await prisma.$transaction([
      ...(current
        ? [prisma.socialGa4Property.update({ where: { id: current.id }, data: { customerId: null } }), ...dropSyncedData(organizationId, current.propertyId)]
        : []),
      prisma.socialGa4Property.update({ where: { id: target.id }, data: { customerId, status: 'active', lastError: null, lastSyncedAt: null } }),
      ...dropSyncedData(organizationId, target.propertyId),
    ]);
    return target.id;
  },

  async propertyRowFor(organizationId: string, customerId: string) {
    return prisma.socialGa4Property.findFirst({ where: { organizationId, customerId }, select: { id: true } });
  },

  /** Pulls 90 days of daily metrics and the 30-day breakdown for one assigned property. */
  async syncProperty(propertyRowId: string): Promise<void> {
    const property = await prisma.socialGa4Property.findUnique({ where: { id: propertyRowId } });
    if (!property?.customerId) return;
    const customerId = property.customerId;
    const connection = await prisma.socialGa4Connection.findUnique({ where: { organizationId: property.organizationId } });
    if (!connection) return;

    try {
      const token = await accessTokenFor(connection);
      const details = await getPropertyDetails(token, property.propertyId);
      const timeZone = details.timeZone ?? property.timeZone ?? 'Asia/Kolkata';

      const daily = parseDailyReport(
        await runReport(token, property.propertyId, {
          dateRanges: [{ startDate: `${DAILY_DAYS - 1}daysAgo`, endDate: 'today' }],
          dimensions: [{ name: 'date' }],
          metrics: DAILY_METRICS.map((name) => ({ name })),
          orderBys: [{ dimension: { dimensionName: 'date' } }],
          limit: DAILY_DAYS + 5,
        })
      );

      const [totalsReport, channels, sources, landing, devices] = await batchRunReports(token, property.propertyId, [
        {
          dateRanges: [{ startDate: `${BREAKDOWN_DAYS - 1}daysAgo`, endDate: 'today' }],
          metrics: DAILY_METRICS.map((name) => ({ name })),
        },
        breakdownRequest('sessionDefaultChannelGroup', BREAKDOWN_DAYS),
        breakdownRequest('sessionSourceMedium', BREAKDOWN_DAYS),
        breakdownRequest('landingPage', BREAKDOWN_DAYS),
        breakdownRequest('deviceCategory', BREAKDOWN_DAYS, 5),
      ]);

      // The property may have been reassigned while the reports ran: never write under a stale client.
      const still = await prisma.socialGa4Property.findUnique({ where: { id: property.id }, select: { customerId: true } });
      if (still?.customerId !== customerId) return;

      const base = { organizationId: property.organizationId, customerId, propertyId: property.propertyId };
      // Upsert in small parallel batches so a 90-day sync does not spend minutes on serial DB writes.
      const CHUNK = 15;
      for (let i = 0; i < daily.length; i += CHUNK) {
        await Promise.all(
          daily.slice(i, i + CHUNK).map(async (day) => {
            const { date, ...metrics } = day;
            const row = {
              ...metrics,
              revenue: metrics.revenue.toFixed(2),
              keyEvents: metrics.keyEvents.toFixed(2),
              customerId,
            };
            await prisma.ga4DailyMetric.upsert({
              where: {
                organizationId_propertyId_date: {
                  organizationId: property.organizationId,
                  propertyId: property.propertyId,
                  date: dayToDate(date),
                },
              },
              update: row,
              create: { ...base, date: dayToDate(date), ...row },
            });
          })
        );
      }

      const today = localDay(new Date(), timeZone);
      const json = (value: unknown) => value as Prisma.InputJsonValue;
      const rowsOf = (report: typeof channels) => json(report ? parseBreakdownReport(report) : []);
      const snapshot = {
        customerId,
        periodStart: dayToDate(shiftDay(today, -(BREAKDOWN_DAYS - 1))),
        periodEnd: dayToDate(today),
        totals: json(parseTotalsReport(totalsReport ?? {})),
        channels: rowsOf(channels),
        sources: rowsOf(sources),
        landing: rowsOf(landing),
        devices: rowsOf(devices),
      };
      await prisma.ga4TrafficSnapshot.upsert({
        where: { organizationId_propertyId: { organizationId: property.organizationId, propertyId: property.propertyId } },
        update: snapshot,
        create: { ...base, ...snapshot },
      });

      await prisma.socialGa4Property.update({
        where: { id: property.id },
        data: {
          displayName: details.displayName ?? property.displayName,
          currency: details.currency,
          timeZone,
          status: 'active',
          lastError: null,
          lastSyncedAt: new Date(),
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Google Analytics sync failed';
      await prisma.socialGa4Property.update({ where: { id: property.id }, data: { status: 'error', lastError: message.slice(0, 1000) } });
      if (error instanceof Ga4ApiError && error.status === 429) throw error; // let BullMQ retry later
      console.error(`[growth] GA4 sync failed for property ${property.propertyId}: ${message}`);
    }
  },

  async allAssignedPropertyIds(): Promise<string[]> {
    const rows = await prisma.socialGa4Property.findMany({ where: { customerId: { not: null } }, select: { id: true } });
    return rows.map((r) => r.id);
  },

  /** Website-tab numbers for one client. No tokens, no other client's data. */
  async website(organizationId: string, customerId: string): Promise<Ga4WebsiteDto> {
    const property = await prisma.socialGa4Property.findFirst({ where: { organizationId, customerId } });
    if (!property) return { property: null, snapshot: null };
    const snap = await prisma.ga4TrafficSnapshot.findFirst({
      where: { organizationId, customerId, propertyId: property.propertyId },
    });
    return {
      property: toPropertyDto(property),
      snapshot: snap
        ? {
            periodStart: snap.periodStart.toISOString().slice(0, 10),
            periodEnd: snap.periodEnd.toISOString().slice(0, 10),
            totals: snap.totals as unknown as Ga4Totals,
            channels: snap.channels as unknown as Ga4BreakdownRow[],
            sources: snap.sources as unknown as Ga4BreakdownRow[],
            landing: snap.landing as unknown as Ga4BreakdownRow[],
            devices: snap.devices as unknown as Ga4BreakdownRow[],
            updatedAt: snap.updatedAt.toISOString(),
          }
        : null,
    };
  },
};

/** Synced rows of a property, removed whenever its client changes so numbers never cross clients. */
function dropSyncedData(organizationId: string, propertyId: string) {
  return [
    prisma.ga4DailyMetric.deleteMany({ where: { organizationId, propertyId } }),
    prisma.ga4TrafficSnapshot.deleteMany({ where: { organizationId, propertyId } }),
  ];
}
