import 'server-only';
import { decrypt, encrypt } from '@/shared/lib/crypto';
import { getServerEnv } from '@/shared/lib/env';
import { HttpError } from '@/shared/server/http-error';
import { prisma } from '@/shared/lib/prisma';
import { ADS_LEAD_ACTION_TYPES } from '../../config/ads';
import { previousAdsRange } from '../../config/ads';
import {
  ADS_REPORT_BREAKDOWNS,
  type AdAccountItem,
  type AdsAdItem,
  type AdsAdSetItem,
  type AdsAdSetTargeting,
  type AdsAudienceItem,
  type AdsCampaignItem,
  type AdsCatalogItem,
  type AdsCatalogsResult,
  type AdsDailyPoint,
  type AdsEntityHistory,
  type AdsHistoryPoint,
  type AdsLeadItem,
  type AdsLiveAd,
  type AdsOverview,
  type AdsReportBreakdown,
  type AdsReportLevel,
  type AdsReportResult,
  type AdsReportRow,
  type AdsTotals,
} from '../../types/ads';
import {
  GraphApiError,
  graphGet,
  graphPost,
  type GraphConfig,
  type GraphList,
} from '../integrations/providers/meta/graph-client';
import type { AdsOverviewDateQuery } from './ads.schema';

type GraphPagedList<T> = GraphList<T> & {
  paging?: { cursors?: { after?: string }; next?: string };
};

// Reads are live from Graph. The only write is pause/resume (`status`) — never create, duplicate, or change spend.

interface GraphAction {
  action_type: string;
  value: string;
}

interface GraphInsight {
  campaign_id?: string;
  campaign_name?: string;
  adset_id?: string;
  adset_name?: string;
  ad_id?: string;
  ad_name?: string;
  date_start?: string;
  spend?: string;
  impressions?: string;
  reach?: string;
  clicks?: string;
  ctr?: string;
  cpc?: string;
  cpm?: string;
  frequency?: string;
  inline_link_clicks?: string;
  age?: string;
  gender?: string;
  country?: string;
  publisher_platform?: string;
  platform_position?: string;
  impression_device?: string;
  actions?: GraphAction[];
}

interface GraphAdAccount {
  id: string;
  name: string;
  currency: string;
  account_status: number;
  amount_spent?: string;
}

interface GraphCampaign {
  id: string;
  name: string;
  effective_status: string;
  objective: string;
  daily_budget?: string;
  lifetime_budget?: string;
  start_time?: string;
  stop_time?: string;
  bid_strategy?: string;
}

interface GraphTargetingInterest {
  id?: string;
  name?: string;
}

interface GraphTargeting {
  age_min?: number;
  age_max?: number;
  geo_locations?: {
    countries?: string[];
    country_groups?: string[];
    regions?: { key?: string; name?: string }[];
    cities?: { key?: string; name?: string }[];
    zips?: { key?: string; name?: string }[];
    location_types?: string[];
  };
  flexible_spec?: {
    interests?: GraphTargetingInterest[];
    behaviors?: GraphTargetingInterest[];
  }[];
  interests?: GraphTargetingInterest[];
  behaviors?: GraphTargetingInterest[];
}

interface GraphAdSet {
  id: string;
  name: string;
  effective_status: string;
  campaign_id?: string;
  campaign?: { id: string; name: string };
  targeting?: GraphTargeting;
  start_time?: string;
  end_time?: string;
  daily_budget?: string;
  lifetime_budget?: string;
  bid_strategy?: string;
  attribution_spec?: { event_type?: string; window_days?: number }[];
}

interface GraphRecommendation {
  object_ids?: string[];
  recommendation_type?: string;
}

interface GraphLinkData {
  message?: string;
  name?: string;
  description?: string;
  caption?: string;
  link?: string;
  image_hash?: string;
  picture?: string;
}

interface GraphVideoData {
  title?: string;
  message?: string;
  link_description?: string;
  image_url?: string;
}

interface GraphObjectStorySpec {
  page_id?: string;
  link_data?: GraphLinkData;
  video_data?: GraphVideoData;
  photo_data?: { caption?: string; url?: string };
}

interface GraphAssetFeedSpec {
  bodies?: { text?: string }[];
  titles?: { text?: string }[];
  descriptions?: { text?: string }[];
  images?: { hash?: string; url?: string }[];
  videos?: { video_id?: string; thumbnail_url?: string }[];
}

interface GraphAdCreative {
  id?: string;
  name?: string;
  title?: string;
  body?: string;
  thumbnail_url?: string;
  image_url?: string;
  object_story_spec?: GraphObjectStorySpec;
  asset_feed_spec?: GraphAssetFeedSpec;
}

interface GraphAd {
  id: string;
  name: string;
  effective_status: string;
  campaign_id?: string;
  adset_id?: string;
  campaign?: { id: string; name: string };
  adset?: { id: string; name: string };
  creative?: GraphAdCreative;
}

interface GraphCustomAudience {
  id: string;
  name?: string;
  subtype?: string;
  approximate_count_lower_bound?: string;
  approximate_count_upper_bound?: string;
  operation_status?: { code?: number; description?: string };
  delivery_status?: { code?: number; description?: string };
  time_created?: string;
  time_updated?: string;
}

interface GraphBusiness {
  id: string;
  name?: string;
}

interface GraphCatalog {
  id: string;
  name?: string;
  vertical?: string;
  product_count?: number;
  feed_count?: number;
}

interface GraphProductSet {
  id: string;
  name?: string;
  product_count?: number;
}

interface GraphLead {
  id: string;
  created_time?: string;
  ad_id?: string;
  ad_name?: string;
  adset_id?: string;
  adset_name?: string;
  campaign_id?: string;
  campaign_name?: string;
  form_id?: string;
  field_data?: { name: string; values: string[] }[];
}

const LEAD_FETCH_CONCURRENCY = 4;
const LEAD_ADS_LIMIT = 50;
const LEADS_PER_AD = 100;
const PAGE_SIZE = 100;
const MAX_PAGES = 20;

function graphConfig(): GraphConfig {
  const env = getServerEnv();
  return { version: env.META_GRAPH_VERSION, appSecret: env.META_APP_SECRET || undefined };
}

/**
 * Bootstrap token for agency `me/adaccounts` sync only.
 * Live reads and the ads worker use per-account `accessTokenEncrypted` — never this env value.
 */
function bootstrapSyncToken(): string {
  const token = getServerEnv().META_SYSTEM_USER_TOKEN;
  if (!token) {
    throw new HttpError(
      503,
      'Ads sync is not configured. Set META_SYSTEM_USER_TOKEN for initial account discovery, or set a per-account token via the admin API.'
    );
  }
  return token;
}

async function markAccountRefreshNeeded(externalId: string): Promise<void> {
  await prisma.adAccount.updateMany({
    where: { externalId },
    data: { refreshNeeded: true },
  });
}

function formatBidStrategy(raw: string | undefined): string | null {
  if (!raw) return null;
  const labels: Record<string, string> = {
    LOWEST_COST_WITHOUT_CAP: 'Highest volume',
    LOWEST_COST_WITH_BID_CAP: 'Bid cap',
    COST_CAP: 'Cost cap',
    LOWEST_COST_WITH_MIN_ROAS: 'Minimum ROAS',
    LOWEST_COST_WITH_MIN_ROAS_GOAL: 'Minimum ROAS',
  };
  return labels[raw] ?? raw.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

function formatAttribution(spec: GraphAdSet['attribution_spec']): string | null {
  if (!spec?.length) return null;
  const parts = spec
    .map((item) => {
      const days = item.window_days;
      if (!days) return null;
      if (item.event_type === 'CLICK_THROUGH') return `${days}-day click`;
      if (item.event_type === 'VIEW_THROUGH' || item.event_type === 'ENGAGED_VIDEO_VIEW') {
        return `${days}-day view`;
      }
      return `${days}-day`;
    })
    .filter((part): part is string => Boolean(part));
  if (parts.length === 0) return null;
  return parts.join(' or ');
}

function formatEnds(iso: string | undefined): string | null {
  if (!iso) return null;
  const date = iso.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
}

function recommendationCounts(rows: GraphRecommendation[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    for (const id of row.object_ids ?? []) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  return counts;
}

function insightExtras(row: GraphInsight | undefined) {
  const linkClicks = row?.inline_link_clicks ? num(row.inline_link_clicks) : null;
  return {
    reach: row?.reach != null ? num(row.reach) : null,
    frequency: row?.frequency != null ? num(row.frequency) : null,
    cpm: row?.cpm != null ? num(row.cpm) : null,
    linkClicks,
  };
}

function breakdownLabel(row: GraphInsight): string {
  return (
    [
      row.age,
      row.gender,
      row.country,
      row.publisher_platform,
      row.platform_position,
      row.impression_device,
    ]
      .filter(Boolean)
      .join(' · ') || 'All'
  );
}

function graphBreakdowns(breakdown: AdsReportBreakdown): string[] {
  return [...(ADS_REPORT_BREAKDOWNS.find((item) => item.value === breakdown)?.graph ?? [])];
}

async function get<T>(
  token: string,
  path: string,
  params: Record<string, string | number | undefined> = {},
  accountExternalId?: string
): Promise<T> {
  try {
    return await graphGet<T>(graphConfig(), path, token, params);
  } catch (error) {
    if (error instanceof GraphApiError) {
      if (error.isAuthError) {
        if (accountExternalId) await markAccountRefreshNeeded(accountExternalId);
        throw new HttpError(
          503,
          'The Meta ad account token is expired or revoked. Set a new token for this account.'
        );
      }
      if (error.code === 10 || error.code === 200 || error.code === 294) {
        throw new HttpError(403, 'This token has no access to this ad account (needs ads_read).');
      }
      if (error.code === 17 || error.code === 80004) {
        throw new HttpError(429, 'Meta rate limit reached for this ad account. Try again in a few minutes.');
      }
      throw new HttpError(502, `Meta: ${error.message}`);
    }
    throw error;
  }
}

async function post<T>(
  token: string,
  path: string,
  body: unknown,
  accountExternalId?: string
): Promise<T> {
  try {
    return await graphPost<T>(graphConfig(), path, token, body);
  } catch (error) {
    if (error instanceof GraphApiError) {
      if (error.isAuthError) {
        if (accountExternalId) await markAccountRefreshNeeded(accountExternalId);
        throw new HttpError(
          503,
          'The Meta ad account token is expired or revoked. Set a new token for this account.'
        );
      }
      if (error.code === 10 || error.code === 200 || error.code === 294) {
        throw new HttpError(403, 'This token cannot change ads (needs ads_management).');
      }
      if (error.code === 17 || error.code === 80004) {
        throw new HttpError(429, 'Meta rate limit reached for this ad account. Try again in a few minutes.');
      }
      throw new HttpError(502, `Meta: ${error.message}`);
    }
    throw error;
  }
}

/** Follow Meta cursor pages so live / hierarchy lists are complete. */
async function getPaged<T>(
  token: string,
  path: string,
  params: Record<string, string | number>,
  maxPages = MAX_PAGES,
  accountExternalId?: string
): Promise<T[]> {
  const items: T[] = [];
  let after: string | undefined;
  for (let page = 0; page < maxPages; page += 1) {
    const result = await get<GraphPagedList<T>>(
      token,
      path,
      {
        ...params,
        limit: Number(params.limit) || PAGE_SIZE,
        ...(after ? { after } : {}),
      },
      accountExternalId
    );
    items.push(...(result.data ?? []));
    after = result.paging?.cursors?.after;
    if (!after || !(result.data?.length)) break;
  }
  return items;
}

function toHistoryPoint(row: GraphInsight): AdsHistoryPoint {
  const totals = toTotals(row);
  return {
    date: row.date_start ?? '',
    spend: totals.spend,
    impressions: totals.impressions,
    clicks: totals.clicks,
    ctr: totals.ctr,
    cpc: totals.cpc,
    leads: totals.leads,
  };
}

function adItemToLiveAd(ad: AdsAdItem): AdsLiveAd {
  return {
    id: ad.id,
    name: ad.name,
    status: ad.status,
    campaignId: ad.campaignId,
    campaignName: ad.campaignName,
    adsetId: ad.adsetId,
    adsetName: ad.adsetName,
    thumbnailUrl: ad.thumbnailUrl,
    headline: ad.headline,
    body: ad.primaryText,
    spend: ad.spend,
    impressions: ad.impressions,
    clicks: ad.clicks,
    ctr: ad.ctr,
    leads: ad.leads,
    costPerLead: ad.costPerLead,
  };
}

const num = (value: string | number | undefined) =>
  value === undefined || value === '' ? 0 : Number(value);

function actionValue(actions: GraphAction[] | undefined, types: readonly string[]): number {
  if (!actions) return 0;
  for (const type of types) {
    const match = actions.find((action) => action.action_type === type);
    if (match) return num(match.value);
  }
  return 0;
}

function leadsOf(actions: GraphAction[] | undefined): number {
  return actionValue(actions, ADS_LEAD_ACTION_TYPES);
}

function landingPageViewsOf(actions: GraphAction[] | undefined): number {
  return actionValue(actions, ['landing_page_view', 'omni_landing_page_view']);
}

function toTotals(row: GraphInsight | undefined): AdsTotals {
  const spend = num(row?.spend);
  const leads = leadsOf(row?.actions);
  return {
    spend,
    impressions: num(row?.impressions),
    reach: num(row?.reach),
    clicks: num(row?.clicks),
    ctr: num(row?.ctr),
    cpc: num(row?.cpc),
    leads,
    costPerLead: leads ? spend / leads : null,
  };
}

function toAccount(account: GraphAdAccount): AdAccountItem {
  return {
    id: account.id,
    name: account.name,
    currency: account.currency,
    status: account.account_status,
    amountSpent: num(account.amount_spent) / 100,
    hasToken: false,
    refreshNeeded: false,
  };
}

function insightDateParams(date: AdsOverviewDateQuery): Record<string, string> {
  if (date.mode === 'range') {
    return { time_range: JSON.stringify({ since: date.since, until: date.until }) };
  }
  return { date_preset: date.datePreset };
}

function budgetFromCampaign(
  campaign: GraphCampaign,
  currency: string
): Pick<AdsCampaignItem, 'budgetLabel' | 'budgetAmount' | 'budgetType'> {
  const daily = num(campaign.daily_budget) / 100;
  const lifetime = num(campaign.lifetime_budget) / 100;
  const format = (value: number) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(value);

  if (daily > 0) {
    return { budgetAmount: daily, budgetType: 'daily', budgetLabel: `${format(daily)} Daily` };
  }
  if (lifetime > 0) {
    return {
      budgetAmount: lifetime,
      budgetType: 'lifetime',
      budgetLabel: `${format(lifetime)} Lifetime`,
    };
  }
  return { budgetAmount: null, budgetType: null, budgetLabel: null };
}

function uniqueNames(entries: GraphTargetingInterest[] | undefined): string[] {
  if (!entries) return [];
  const names = entries.map((entry) => entry.name?.trim()).filter((name): name is string => Boolean(name));
  return [...new Set(names)];
}

function parseTargeting(targeting: GraphTargeting | undefined): AdsAdSetTargeting {
  if (!targeting) {
    return { ageMin: null, ageMax: null, locations: [], interests: [], behaviors: [] };
  }

  const locations: string[] = [];
  const geo = targeting.geo_locations;
  if (geo?.countries?.length) locations.push(...geo.countries);
  if (geo?.country_groups?.length) locations.push(...geo.country_groups);
  if (geo?.regions) {
    locations.push(...geo.regions.map((region) => region.name).filter((name): name is string => Boolean(name)));
  }
  if (geo?.cities) {
    locations.push(...geo.cities.map((city) => city.name).filter((name): name is string => Boolean(name)));
  }
  if (geo?.zips) {
    locations.push(...geo.zips.map((zip) => zip.name ?? zip.key).filter((name): name is string => Boolean(name)));
  }

  const interests = [
    ...uniqueNames(targeting.interests),
    ...(targeting.flexible_spec ?? []).flatMap((spec) => uniqueNames(spec.interests)),
  ];
  const behaviors = [
    ...uniqueNames(targeting.behaviors),
    ...(targeting.flexible_spec ?? []).flatMap((spec) => uniqueNames(spec.behaviors)),
  ];

  return {
    ageMin: targeting.age_min ?? null,
    ageMax: targeting.age_max ?? null,
    locations: [...new Set(locations)],
    interests: [...new Set(interests)],
    behaviors: [...new Set(behaviors)],
  };
}

function creativeFields(creative: GraphAdCreative | undefined): {
  thumbnailUrl: string | null;
  primaryText: string | null;
  headline: string | null;
  description: string | null;
} {
  if (!creative) {
    return { thumbnailUrl: null, primaryText: null, headline: null, description: null };
  }
  const link = creative.object_story_spec?.link_data;
  const video = creative.object_story_spec?.video_data;
  const photo = creative.object_story_spec?.photo_data;
  const feed = creative.asset_feed_spec;

  const primaryText =
    creative.body ??
    link?.message ??
    video?.message ??
    photo?.caption ??
    feed?.bodies?.[0]?.text ??
    null;
  const headline =
    creative.title ?? link?.name ?? video?.title ?? feed?.titles?.[0]?.text ?? creative.name ?? null;
  const description =
    link?.description ??
    video?.link_description ??
    link?.caption ??
    feed?.descriptions?.[0]?.text ??
    null;
  const thumbnailUrl =
    creative.thumbnail_url ??
    creative.image_url ??
    link?.picture ??
    video?.image_url ??
    photo?.url ??
    feed?.images?.[0]?.url ??
    feed?.videos?.[0]?.thumbnail_url ??
    null;

  return { thumbnailUrl, primaryText, headline, description };
}

async function mapPool<T, R>(items: T[], concurrency: number, mapper: (item: T) => Promise<R>) {
  if (items.length === 0) return [] as R[];
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await mapper(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

async function fetchLeadsForAds(
  token: string,
  accountExternalId: string,
  ads: { id: string; name: string; adsetId: string | null; adsetName: string | null }[],
  insightLeadsByAd: Map<string, number>
): Promise<AdsLeadItem[]> {
  const candidates = ads
    .filter((ad) => (insightLeadsByAd.get(ad.id) ?? 0) > 0)
    .slice(0, LEAD_ADS_LIMIT);

  const batches = await mapPool(candidates, LEAD_FETCH_CONCURRENCY, async (ad) => {
    try {
      const result = await get<GraphList<GraphLead>>(
        token,
        `${ad.id}/leads`,
        {
          fields:
            'created_time,id,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,form_id,field_data',
          limit: LEADS_PER_AD,
        },
        accountExternalId
      );
      return result.data.map((lead) => ({
        id: lead.id,
        createdTime: lead.created_time ?? '',
        adId: lead.ad_id ?? ad.id,
        adName: lead.ad_name ?? ad.name,
        adsetId: lead.adset_id ?? ad.adsetId,
        adsetName: lead.adset_name ?? ad.adsetName,
        campaignId: lead.campaign_id ?? null,
        campaignName: lead.campaign_name ?? null,
        formId: lead.form_id ?? null,
        fields: (lead.field_data ?? []).map((field) => ({
          name: field.name,
          values: field.values ?? [],
        })),
      }));
    } catch {
      return [] as AdsLeadItem[];
    }
  });

  const leads = batches.flat();
  leads.sort((a, b) => b.createdTime.localeCompare(a.createdTime));
  return leads;
}

import { scopeWhere, type ClientScope } from '@/shared/server/client-scope';

export const adsService = {
  /** True when bootstrap env token is set (agency discovery sync). */
  isConfigured(): boolean {
    return Boolean(getServerEnv().META_SYSTEM_USER_TOKEN);
  },

  /**
   * Ads UI is usable when bootstrap sync is available or any scoped account already has a token.
   */
  async isConfiguredForOrg(organizationId: string): Promise<boolean> {
    if (this.isConfigured()) return true;
    const withToken = await prisma.adAccount.count({
      where: { organizationId, accessTokenEncrypted: { not: null } },
    });
    return withToken > 0;
  },

  /**
   * Ad accounts assigned in DB for this scope (organization + optional client filter).
   * Never uses Meta `me/adaccounts` — that is sync-only.
   */
  async listAccounts(scope: ClientScope): Promise<AdAccountItem[]> {
    const accounts = await prisma.adAccount.findMany({
      where: scopeWhere(scope),
      orderBy: { name: 'asc' },
    });
    return accounts.map((acc) => ({
      id: acc.externalId,
      name: acc.name,
      currency: acc.currency,
      status: acc.status,
      amountSpent: 0,
      hasToken: Boolean(acc.accessTokenEncrypted),
      refreshNeeded: acc.refreshNeeded,
    }));
  },

  /** Ensures the account is in scope; throws 404 otherwise (no cross-client leak). */
  async requireAccount(scope: ClientScope, accountId: string): Promise<AdAccountItem> {
    const accounts = await this.listAccounts(scope);
    const account = accounts.find((item) => item.id === accountId);
    if (!account) {
      throw new HttpError(404, 'Ad account not found or not shared with the system user');
    }
    return account;
  },

  /**
   * Decrypt the stored per-account Meta token. Refuses when missing (no global env fallback).
   */
  async requireAccountToken(scope: ClientScope, accountId: string): Promise<string> {
    await this.requireAccount(scope, accountId);
    const row = await prisma.adAccount.findFirst({
      where: { externalId: accountId, ...scopeWhere(scope) },
      select: { accessTokenEncrypted: true, refreshNeeded: true },
    });
    if (!row?.accessTokenEncrypted) {
      throw new HttpError(
        503,
        'No Meta token stored for this ad account. An admin must set one (POST /api/social/ads/accounts/{id}/token) or re-run account sync with META_SYSTEM_USER_TOKEN.'
      );
    }
    try {
      return decrypt(row.accessTokenEncrypted);
    } catch {
      throw new HttpError(503, 'Stored ad account token could not be decrypted. Set a new token.');
    }
  },

  /**
   * Admin/agency: encrypt and store a Meta token for one ad account in this organization.
   */
  async setAccountToken(organizationId: string, accountId: string, accessToken: string): Promise<void> {
    const row = await prisma.adAccount.findFirst({
      where: { organizationId, externalId: accountId },
      select: { id: true },
    });
    if (!row) {
      throw new HttpError(404, 'Ad account not found in this organization');
    }
    await prisma.adAccount.update({
      where: { id: row.id },
      data: {
        accessTokenEncrypted: encrypt(accessToken.trim()),
        refreshNeeded: false,
        tokenSource: 'per_account',
      },
    });
  },

  /**
   * Agency sync: pulls Meta `me/adaccounts` into `ad_accounts` for this organization.
   * Uses META_SYSTEM_USER_TOKEN for discovery only and stores that token on each upserted account.
   * Does not change customerId assignment; UI lists still come from listAccounts(scope).
   */
  async syncAccounts(organizationId: string): Promise<void> {
    const token = bootstrapSyncToken();
    const encrypted = encrypt(token);
    const result = await getPaged<{
      id: string;
      name?: string;
      currency?: string;
      timezone_name?: string;
      account_status?: number;
    }>(token, 'me/adaccounts', { fields: 'name,currency,timezone_name,account_status' });
    for (const acc of result) {
      await prisma.adAccount.upsert({
        where: { externalId: acc.id },
        update: {
          name: acc.name ?? acc.id,
          // Meta always returns `currency` for a real ad account; INR (not USD) is the
          // correct last-resort default for this agency's accounts if it's ever missing.
          currency: acc.currency ?? 'INR',
          timezoneName: acc.timezone_name ?? 'UTC',
          status: acc.account_status ?? 1,
        },
        create: {
          organizationId,
          externalId: acc.id,
          name: acc.name ?? acc.id,
          currency: acc.currency ?? 'INR',
          timezoneName: acc.timezone_name ?? 'UTC',
          status: acc.account_status ?? 1,
          accessTokenEncrypted: encrypted,
          refreshNeeded: false,
          tokenSource: 'system_user',
        },
      });
    }

    // Stamp bootstrap token onto new/empty rows and any still on system_user source.
    // Never overwrite tokenSource=per_account (set via admin API).
    await prisma.adAccount.updateMany({
      where: {
        organizationId,
        OR: [{ accessTokenEncrypted: null }, { tokenSource: 'system_user' }],
      },
      data: {
        accessTokenEncrypted: encrypted,
        refreshNeeded: false,
        tokenSource: 'system_user',
      },
    });
  },

  async overview(scope: ClientScope, accountId: string, date: AdsOverviewDateQuery): Promise<AdsOverview> {
    const account = await this.requireAccount(scope, accountId);
    const token = await this.requireAccountToken(scope, accountId);

    const dateParams = insightDateParams(date);

    const [
      totals,
      daily,
      campaignInsights,
      adsetInsights,
      adInsights,
      campaigns,
      adSets,
      adsRaw,
    ] = await Promise.all([
      get<GraphList<GraphInsight>>(
        token,
        `${accountId}/insights`,
        {
          fields: 'spend,impressions,reach,clicks,ctr,cpc,actions',
          ...dateParams,
        },
        accountId
      ),
      getPaged<GraphInsight>(
        token,
        `${accountId}/insights`,
        {
          fields: 'spend,clicks',
          ...dateParams,
          time_increment: 1,
          limit: PAGE_SIZE,
        },
        MAX_PAGES,
        accountId
      ).then((data) => ({ data })),
      getPaged<GraphInsight>(
        token,
        `${accountId}/insights`,
        {
          fields:
            'campaign_id,campaign_name,spend,impressions,reach,clicks,ctr,cpc,cpm,frequency,inline_link_clicks,actions',
          level: 'campaign',
          ...dateParams,
          limit: PAGE_SIZE,
        },
        MAX_PAGES,
        accountId
      ).then((data) => ({ data })),
      getPaged<GraphInsight>(
        token,
        `${accountId}/insights`,
        {
          fields:
            'adset_id,adset_name,spend,impressions,reach,clicks,ctr,cpc,cpm,frequency,inline_link_clicks,actions',
          level: 'adset',
          ...dateParams,
          limit: PAGE_SIZE,
        },
        MAX_PAGES,
        accountId
      )
        .then((data) => ({ data }))
        .catch(() => ({ data: [] as GraphInsight[] })),
      getPaged<GraphInsight>(
        token,
        `${accountId}/insights`,
        {
          fields:
            'ad_id,ad_name,spend,impressions,reach,clicks,ctr,cpc,cpm,frequency,inline_link_clicks,actions',
          level: 'ad',
          ...dateParams,
          limit: PAGE_SIZE,
        },
        MAX_PAGES,
        accountId
      )
        .then((data) => ({ data }))
        .catch(() => ({ data: [] as GraphInsight[] })),
      getPaged<GraphCampaign>(
        token,
        `${accountId}/campaigns`,
        {
          fields:
            'name,effective_status,objective,daily_budget,lifetime_budget,start_time,stop_time,bid_strategy',
          limit: PAGE_SIZE,
        },
        MAX_PAGES,
        accountId
      ),
      getPaged<GraphAdSet>(
        token,
        `${accountId}/adsets`,
        {
          fields:
            'name,effective_status,campaign_id,campaign{name},targeting,start_time,end_time,daily_budget,lifetime_budget,bid_strategy,attribution_spec',
          limit: PAGE_SIZE,
        },
        MAX_PAGES,
        accountId
      ),
      getPaged<GraphAd>(
        token,
        `${accountId}/ads`,
        {
          fields:
            'name,effective_status,campaign_id,adset_id,campaign{name},adset{name},creative{id,name,title,body,thumbnail_url,image_url,object_story_spec,asset_feed_spec}',
          limit: PAGE_SIZE,
        },
        MAX_PAGES,
        accountId
      ),
    ]);

    const insightByCampaign = new Map(campaignInsights.data.map((row) => [row.campaign_id, row]));
    const insightByAdSet = new Map(adsetInsights.data.map((row) => [row.adset_id, row]));
    const insightByAd = new Map(
      adInsights.data
        .filter((row): row is GraphInsight & { ad_id: string } => Boolean(row.ad_id))
        .map((row) => [row.ad_id, row])
    );
    const recCounts = recommendationCounts(
      await getPaged<GraphRecommendation>(
        token,
        `${accountId}/recommendations`,
        { fields: 'object_ids,recommendation_type', limit: PAGE_SIZE },
        3,
        accountId
      ).catch(() => [] as GraphRecommendation[])
    );
    const attributionByCampaign = new Map<string, string | null>();
    for (const adset of adSets) {
      const campaignId = adset.campaign_id ?? adset.campaign?.id;
      if (!campaignId || attributionByCampaign.has(campaignId)) continue;
      attributionByCampaign.set(campaignId, formatAttribution(adset.attribution_spec));
    }

    const campaignItems: AdsCampaignItem[] = campaigns.map((campaign) => {
      const insight = insightByCampaign.get(campaign.id);
      const stats = toTotals(insight);
      const extras = insightExtras(insight);
      const budget = budgetFromCampaign(campaign, account.currency);
      return {
        id: campaign.id,
        name: campaign.name,
        status: campaign.effective_status,
        objective: campaign.objective,
        ...budget,
        spend: stats.spend,
        impressions: stats.impressions,
        clicks: stats.clicks,
        ctr: stats.ctr,
        cpc: stats.cpc,
        leads: stats.leads,
        costPerLead: stats.costPerLead,
        landingPageViews: landingPageViewsOf(insight?.actions),
        ...extras,
        startsAt: formatEnds(campaign.start_time),
        endsAt: formatEnds(campaign.stop_time),
        attributionLabel: attributionByCampaign.get(campaign.id) ?? null,
        bidStrategyLabel: formatBidStrategy(campaign.bid_strategy),
        recommendations: recCounts.get(campaign.id) ?? 0,
      };
    });
    campaignItems.sort(
      (a, b) => Number(b.status === 'ACTIVE') - Number(a.status === 'ACTIVE') || b.spend - a.spend
    );

    const adSetItems: AdsAdSetItem[] = adSets.map((adset) => {
      const insight = insightByAdSet.get(adset.id);
      const stats = toTotals(insight);
      const extras = insightExtras(insight);
      return {
        id: adset.id,
        name: adset.name,
        status: adset.effective_status,
        campaignId: adset.campaign_id ?? adset.campaign?.id ?? null,
        campaignName: adset.campaign?.name ?? null,
        targeting: parseTargeting(adset.targeting),
        spend: stats.spend,
        impressions: extras.reach != null || stats.impressions ? stats.impressions : null,
        clicks: insight ? stats.clicks : null,
        reach: extras.reach,
        frequency: extras.frequency,
        cpm: extras.cpm,
        ctr: insight ? stats.ctr : null,
        cpc: insight ? stats.cpc : null,
        leads: stats.leads,
        costPerLead: stats.costPerLead,
        startsAt: formatEnds(adset.start_time),
        endsAt: formatEnds(adset.end_time),
        attributionLabel: formatAttribution(adset.attribution_spec),
        bidStrategyLabel: formatBidStrategy(adset.bid_strategy),
        recommendations: recCounts.get(adset.id) ?? 0,
      };
    });
    adSetItems.sort(
      (a, b) => Number(b.status === 'ACTIVE') - Number(a.status === 'ACTIVE') || b.spend - a.spend
    );

    const adItems: AdsAdItem[] = adsRaw.map((ad) => {
      const insight = insightByAd.get(ad.id);
      const stats = toTotals(insight);
      const extras = insightExtras(insight);
      const creative = creativeFields(ad.creative);
      const parent = adSets.find((item) => item.id === (ad.adset_id ?? ad.adset?.id));
      return {
        id: ad.id,
        name: ad.name,
        status: ad.effective_status,
        campaignId: ad.campaign_id ?? ad.campaign?.id ?? null,
        campaignName: ad.campaign?.name ?? null,
        adsetId: ad.adset_id ?? ad.adset?.id ?? null,
        adsetName: ad.adset?.name ?? null,
        thumbnailUrl: creative.thumbnailUrl,
        primaryText: creative.primaryText,
        headline: creative.headline,
        description: creative.description,
        spend: stats.spend,
        impressions: stats.impressions,
        clicks: stats.clicks,
        ctr: stats.ctr,
        cpc: stats.cpc,
        leads: stats.leads,
        costPerLead: stats.costPerLead,
        ...extras,
        startsAt: formatEnds(parent?.start_time),
        endsAt: formatEnds(parent?.end_time),
        attributionLabel: formatAttribution(parent?.attribution_spec),
        bidStrategyLabel: formatBidStrategy(parent?.bid_strategy),
        recommendations: recCounts.get(ad.id) ?? 0,
      };
    });
    adItems.sort(
      (a, b) => Number(b.status === 'ACTIVE') - Number(a.status === 'ACTIVE') || b.spend - a.spend
    );

    // Live grid uses every ACTIVE ad from the full paged list (count matches cards).
    const liveAds: AdsLiveAd[] = adItems
      .filter((ad) => ad.status === 'ACTIVE')
      .map(adItemToLiveAd)
      .sort((a, b) => b.spend - a.spend);

    const insightLeadsByAd = new Map(
      [...insightByAd.entries()].map(([id, row]) => [id, leadsOf(row.actions)])
    );
    const leads = await fetchLeadsForAds(
      token,
      accountId,
      adItems.map((ad) => ({
        id: ad.id,
        name: ad.name,
        adsetId: ad.adsetId,
        adsetName: ad.adsetName,
      })),
      insightLeadsByAd
    );

    const dailyPoints: AdsDailyPoint[] = daily.data.map((row) => ({
      date: row.date_start ?? '',
      spend: num(row.spend),
      clicks: num(row.clicks),
    }));

    return {
      account,
      datePreset: date.mode === 'preset' ? date.datePreset : null,
      since: date.mode === 'range' ? date.since : null,
      until: date.mode === 'range' ? date.until : null,
      totals: toTotals(totals.data[0]),
      daily: dailyPoints,
      campaigns: campaignItems,
      adSets: adSetItems,
      ads: adItems,
      leads,
      liveAds,
    };
  },

  /** Custom audiences on this ad account (read-only; size shown as Meta's approximate range). */
  async audiences(scope: ClientScope, accountId: string): Promise<AdsAudienceItem[]> {
    await this.requireAccount(scope, accountId);
    const token = await this.requireAccountToken(scope, accountId);

    const raw = await getPaged<GraphCustomAudience>(
      token,
      `${accountId}/customaudiences`,
      {
        fields:
          'name,subtype,approximate_count_lower_bound,approximate_count_upper_bound,operation_status,delivery_status,time_created,time_updated',
        limit: PAGE_SIZE,
      },
      MAX_PAGES,
      accountId
    ).catch(() => [] as GraphCustomAudience[]);

    const items: AdsAudienceItem[] = raw.map((audience) => ({
      id: audience.id,
      name: audience.name ?? audience.id,
      subtype: audience.subtype ?? 'UNKNOWN',
      sizeLower: audience.approximate_count_lower_bound
        ? Number(audience.approximate_count_lower_bound)
        : null,
      sizeUpper: audience.approximate_count_upper_bound
        ? Number(audience.approximate_count_upper_bound)
        : null,
      operationStatus: audience.operation_status?.description ?? null,
      deliveryStatus: audience.delivery_status?.description ?? null,
      createdTime: audience.time_created ?? null,
      updatedTime: audience.time_updated ?? null,
    }));
    items.sort((a, b) => (b.sizeUpper ?? 0) - (a.sizeUpper ?? 0));
    return items;
  },

  /** Catalogs owned by this ad account's business, with product sets and basic health. */
  async catalogs(scope: ClientScope, accountId: string): Promise<AdsCatalogsResult> {
    await this.requireAccount(scope, accountId);
    const token = await this.requireAccountToken(scope, accountId);

    const accountBusiness = await get<{ business?: GraphBusiness }>(
      token,
      accountId,
      {
        fields: 'business{id,name}',
      },
      accountId
    ).catch(() => ({ business: undefined }));

    const business = accountBusiness.business;
    if (!business?.id) {
      return { businessId: null, businessName: null, catalogs: [] };
    }

    const rawCatalogs = await getPaged<GraphCatalog>(
      token,
      `${business.id}/owned_product_catalogs`,
      {
        fields: 'name,vertical,product_count,feed_count',
        limit: PAGE_SIZE,
      },
      MAX_PAGES,
      accountId
    ).catch(() => [] as GraphCatalog[]);

    const catalogs: AdsCatalogItem[] = await mapPool(
      rawCatalogs,
      LEAD_FETCH_CONCURRENCY,
      async (catalog) => {
        const productSets = await getPaged<GraphProductSet>(
          token,
          `${catalog.id}/product_sets`,
          {
            fields: 'name,product_count',
            limit: PAGE_SIZE,
          },
          MAX_PAGES,
          accountId
        ).catch(() => [] as GraphProductSet[]);
        return {
          id: catalog.id,
          name: catalog.name ?? catalog.id,
          vertical: catalog.vertical ?? null,
          productCount: catalog.product_count ?? null,
          feedCount: catalog.feed_count ?? null,
          productSets: productSets.map((set) => ({
            id: set.id,
            name: set.name ?? set.id,
            productCount: set.product_count ?? null,
          })),
        };
      }
    );

    return { businessId: business.id, businessName: business.name ?? null, catalogs };
  },

  /** Daily history + period totals for one campaign, ad set, or ad. */
  async entityHistory(
    scope: ClientScope,
    accountId: string,
    kind: 'ad' | 'campaign' | 'adset',
    entityId: string,
    date: AdsOverviewDateQuery
  ): Promise<AdsEntityHistory> {
    await this.requireAccount(scope, accountId);
    const token = await this.requireAccountToken(scope, accountId);

    const dateParams = insightDateParams(date);
    const fields = 'spend,impressions,reach,clicks,ctr,cpc,actions';

    const [totalsRaw, historyRaw] = await Promise.all([
      get<GraphList<GraphInsight>>(
        token,
        `${entityId}/insights`,
        {
          fields,
          ...dateParams,
        },
        accountId
      ),
      getPaged<GraphInsight>(
        token,
        `${entityId}/insights`,
        {
          fields,
          ...dateParams,
          time_increment: 1,
          limit: PAGE_SIZE,
        },
        MAX_PAGES,
        accountId
      ),
    ]);

    const history = historyRaw
      .map(toHistoryPoint)
      .filter((point) => point.date)
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      kind,
      id: entityId,
      totals: toTotals(totalsRaw.data[0]),
      history,
    };
  },

  /** Breakdown report for one ad account (age / gender / placement / device). */
  async report(
    scope: ClientScope,
    accountId: string,
    date: AdsOverviewDateQuery,
    level: AdsReportLevel,
    breakdown: AdsReportBreakdown,
    compare: boolean
  ): Promise<AdsReportResult> {
    await this.requireAccount(scope, accountId);
    const token = await this.requireAccountToken(scope, accountId);
    const dateParams = insightDateParams(date);
    const dims = graphBreakdowns(breakdown);
    const fields =
      level === 'adset'
        ? 'adset_id,adset_name,spend,impressions,reach,clicks,ctr,cpc,actions'
        : level === 'ad'
          ? 'ad_id,ad_name,spend,impressions,reach,clicks,ctr,cpc,actions'
          : 'campaign_id,campaign_name,spend,impressions,reach,clicks,ctr,cpc,actions';

    const fetchRows = (params: Record<string, string | number>) =>
      getPaged<GraphInsight>(
        token,
        `${accountId}/insights`,
        {
          fields,
          level,
          ...params,
          ...(dims.length ? { breakdowns: dims.join(',') } : {}),
          limit: PAGE_SIZE,
        },
        MAX_PAGES,
        accountId
      );

    const current = await fetchRows(dateParams);
    const previousRange = compare ? previousAdsRange(date) : null;
    const previous = previousRange
      ? await fetchRows({
          time_range: JSON.stringify({ since: previousRange.since, until: previousRange.until }),
        }).catch(() => [] as GraphInsight[])
      : [];

    const previousByKey = new Map<string, GraphInsight>();
    for (const row of previous) {
      previousByKey.set(reportRowKey(row, level), row);
    }

    const rows: AdsReportRow[] = current.map((row) => {
      const stats = toTotals(row);
      const prev = previousByKey.get(reportRowKey(row, level));
      const prevStats = prev ? toTotals(prev) : null;
      return {
        entityId:
          (level === 'ad' ? row.ad_id : level === 'adset' ? row.adset_id : row.campaign_id) ?? '',
        entityName:
          (level === 'ad' ? row.ad_name : level === 'adset' ? row.adset_name : row.campaign_name) ??
          '(unnamed)',
        breakdownLabel: breakdown === 'none' ? 'All' : breakdownLabel(row),
        age: row.age ?? null,
        gender: row.gender ?? null,
        country: row.country ?? null,
        publisherPlatform: row.publisher_platform ?? null,
        platformPosition: row.platform_position ?? null,
        device: row.impression_device ?? null,
        spend: stats.spend,
        impressions: stats.impressions,
        reach: stats.reach,
        clicks: stats.clicks,
        leads: stats.leads,
        ctr: stats.ctr,
        cpc: stats.cpc,
        previous: prevStats
          ? {
              spend: prevStats.spend,
              impressions: prevStats.impressions,
              clicks: prevStats.clicks,
              leads: prevStats.leads,
            }
          : null,
      };
    });
    rows.sort((a, b) => b.spend - a.spend);

    return {
      level,
      breakdown,
      since: date.mode === 'range' ? date.since : null,
      until: date.mode === 'range' ? date.until : null,
      datePreset: date.mode === 'preset' ? date.datePreset : null,
      compareSince: previousRange?.since ?? null,
      compareUntil: previousRange?.until ?? null,
      rows,
    };
  },

  /** Pause or resume campaigns / ad sets / ads. Does not create, duplicate, or change budgets. */
  async setEntityStatus(
    scope: ClientScope,
    accountId: string,
    _kind: 'ad' | 'campaign' | 'adset',
    ids: string[],
    status: 'ACTIVE' | 'PAUSED'
  ): Promise<{ updated: string[]; failed: { id: string; error: string }[] }> {
    await this.requireAccount(scope, accountId);
    const token = await this.requireAccountToken(scope, accountId);
    const updated: string[] = [];
    const failed: { id: string; error: string }[] = [];
    for (const id of ids) {
      try {
        await post<{ success?: boolean }>(token, id, { status }, accountId);
        updated.push(id);
      } catch (error) {
        failed.push({
          id,
          error: error instanceof HttpError ? error.message : 'Could not update status',
        });
      }
    }
    return { updated, failed };
  },
};

function reportRowKey(row: GraphInsight, level: AdsReportLevel): string {
  const id = level === 'ad' ? row.ad_id : level === 'adset' ? row.adset_id : row.campaign_id;
  return [
    id ?? '',
    row.age ?? '',
    row.gender ?? '',
    row.country ?? '',
    row.publisher_platform ?? '',
    row.platform_position ?? '',
    row.impression_device ?? '',
  ].join('|');
}
