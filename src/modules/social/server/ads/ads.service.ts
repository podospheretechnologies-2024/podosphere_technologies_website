import 'server-only';
import { getServerEnv } from '@/shared/lib/env';
import { HttpError } from '@/shared/server/http-error';
import { ADS_LEAD_ACTION_TYPES, type AdsDatePreset } from '../../config/ads';
import type {
  AdAccountItem,
  AdsAdItem,
  AdsAdSetItem,
  AdsAdSetTargeting,
  AdsCampaignItem,
  AdsDailyPoint,
  AdsLeadItem,
  AdsLiveAd,
  AdsOverview,
  AdsTotals,
} from '../../types/ads';
import {
  GraphApiError,
  graphGet,
  type GraphConfig,
  type GraphList,
} from '../integrations/providers/meta/graph-client';

// Read-only: nothing here pauses, edits or creates ads. See PODO_SOCIAL.md section 8 (safety rules).

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
const LEAD_ADS_LIMIT = 30;
const LEADS_PER_AD = 100;

function credentials(): { graph: GraphConfig; token: string } {
  const env = getServerEnv();
  if (!env.META_SYSTEM_USER_TOKEN) {
    throw new HttpError(503, 'Ads are not configured. Set META_SYSTEM_USER_TOKEN in .env (see PODO_SOCIAL.md).');
  }
  return {
    graph: { version: env.META_GRAPH_VERSION, appSecret: env.META_APP_SECRET || undefined },
    token: env.META_SYSTEM_USER_TOKEN,
  };
}

async function get<T>(path: string, params: Record<string, string | number>): Promise<T> {
  const { graph, token } = credentials();
  try {
    return await graphGet<T>(graph, path, token, params);
  } catch (error) {
    if (error instanceof GraphApiError) {
      if (error.isAuthError) {
        throw new HttpError(503, 'The Meta system user token is expired or revoked. Generate a new one.');
      }
      if (error.code === 10 || error.code === 200 || error.code === 294) {
        throw new HttpError(403, 'The system user has no access to this ad account (needs ads_read).');
      }
      if (error.code === 17 || error.code === 80004) {
        throw new HttpError(429, 'Meta rate limit reached for this ad account. Try again in a few minutes.');
      }
      throw new HttpError(502, `Meta: ${error.message}`);
    }
    throw error;
  }
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
  };
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
  ads: { id: string; name: string; adsetId: string | null; adsetName: string | null }[],
  insightLeadsByAd: Map<string, number>
): Promise<AdsLeadItem[]> {
  const candidates = ads
    .filter((ad) => (insightLeadsByAd.get(ad.id) ?? 0) > 0)
    .slice(0, LEAD_ADS_LIMIT);

  const batches = await mapPool(candidates, LEAD_FETCH_CONCURRENCY, async (ad) => {
    try {
      const result = await get<GraphList<GraphLead>>(`${ad.id}/leads`, {
        fields:
          'created_time,id,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,form_id,field_data',
        limit: LEADS_PER_AD,
      });
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

export const adsService = {
  isConfigured(): boolean {
    return Boolean(getServerEnv().META_SYSTEM_USER_TOKEN);
  },

  /** Ad accounts the system user was given access to in Business Manager. */
  async listAccounts(): Promise<AdAccountItem[]> {
    const result = await get<GraphList<GraphAdAccount>>('me/adaccounts', {
      fields: 'name,currency,account_status,amount_spent',
      limit: 200,
    });
    return result.data.map(toAccount).sort((a, b) => a.name.localeCompare(b.name));
  },

  async overview(accountId: string, datePreset: AdsDatePreset): Promise<AdsOverview> {
    const accounts = await this.listAccounts();
    const account = accounts.find((item) => item.id === accountId);
    if (!account) {
      throw new HttpError(404, 'Ad account not found or not shared with the system user');
    }

    const [
      totals,
      daily,
      campaignInsights,
      adsetInsights,
      adInsights,
      campaigns,
      adSets,
      adsRaw,
      liveAdsRaw,
    ] = await Promise.all([
      get<GraphList<GraphInsight>>(`${accountId}/insights`, {
        fields: 'spend,impressions,reach,clicks,ctr,cpc,actions',
        date_preset: datePreset,
      }),
      get<GraphList<GraphInsight>>(`${accountId}/insights`, {
        fields: 'spend,clicks',
        date_preset: datePreset,
        time_increment: 1,
        limit: 100,
      }),
      get<GraphList<GraphInsight>>(`${accountId}/insights`, {
        fields: 'campaign_id,campaign_name,spend,impressions,clicks,ctr,cpc,actions',
        level: 'campaign',
        date_preset: datePreset,
        limit: 200,
      }),
      get<GraphList<GraphInsight>>(`${accountId}/insights`, {
        fields: 'adset_id,adset_name,spend,actions',
        level: 'adset',
        date_preset: datePreset,
        limit: 200,
      }).catch(() => ({ data: [] as GraphInsight[] })),
      get<GraphList<GraphInsight>>(`${accountId}/insights`, {
        fields: 'ad_id,ad_name,spend,impressions,clicks,ctr,cpc,actions',
        level: 'ad',
        date_preset: datePreset,
        limit: 200,
      }).catch(() => ({ data: [] as GraphInsight[] })),
      get<GraphList<GraphCampaign>>(`${accountId}/campaigns`, {
        fields: 'name,effective_status,objective,daily_budget,lifetime_budget',
        limit: 200,
      }),
      get<GraphList<GraphAdSet>>(`${accountId}/adsets`, {
        fields: 'name,effective_status,campaign_id,campaign{name},targeting',
        limit: 200,
      }),
      get<GraphList<GraphAd>>(`${accountId}/ads`, {
        fields:
          'name,effective_status,campaign_id,adset_id,campaign{name},adset{name},creative{id,name,title,body,thumbnail_url,image_url,object_story_spec,asset_feed_spec}',
        limit: 200,
      }),
      get<GraphList<GraphAd>>(`${accountId}/ads`, {
        fields:
          'name,effective_status,campaign_id,adset_id,campaign{name},adset{name},creative{name,title,body,thumbnail_url,image_url}',
        effective_status: JSON.stringify(['ACTIVE']),
        limit: 100,
      }),
    ]);

    const insightByCampaign = new Map(campaignInsights.data.map((row) => [row.campaign_id, row]));
    const insightByAdSet = new Map(adsetInsights.data.map((row) => [row.adset_id, row]));
    const insightByAd = new Map(
      adInsights.data
        .filter((row): row is GraphInsight & { ad_id: string } => Boolean(row.ad_id))
        .map((row) => [row.ad_id, row])
    );

    const campaignItems: AdsCampaignItem[] = campaigns.data.map((campaign) => {
      const stats = toTotals(insightByCampaign.get(campaign.id));
      const budget = budgetFromCampaign(campaign, account.currency);
      const actions = insightByCampaign.get(campaign.id)?.actions;
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
        landingPageViews: landingPageViewsOf(actions),
      };
    });
    campaignItems.sort(
      (a, b) => Number(b.status === 'ACTIVE') - Number(a.status === 'ACTIVE') || b.spend - a.spend
    );

    const adSetItems: AdsAdSetItem[] = adSets.data.map((adset) => {
      const stats = toTotals(insightByAdSet.get(adset.id));
      return {
        id: adset.id,
        name: adset.name,
        status: adset.effective_status,
        campaignId: adset.campaign_id ?? adset.campaign?.id ?? null,
        campaignName: adset.campaign?.name ?? null,
        targeting: parseTargeting(adset.targeting),
        spend: stats.spend,
        leads: stats.leads,
        costPerLead: stats.costPerLead,
      };
    });
    adSetItems.sort(
      (a, b) => Number(b.status === 'ACTIVE') - Number(a.status === 'ACTIVE') || b.spend - a.spend
    );

    const adItems: AdsAdItem[] = adsRaw.data.map((ad) => {
      const stats = toTotals(insightByAd.get(ad.id));
      const creative = creativeFields(ad.creative);
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
        clicks: stats.clicks,
        ctr: stats.ctr,
        leads: stats.leads,
        costPerLead: stats.costPerLead,
      };
    });
    adItems.sort(
      (a, b) => Number(b.status === 'ACTIVE') - Number(a.status === 'ACTIVE') || b.spend - a.spend
    );

    const liveAds: AdsLiveAd[] = liveAdsRaw.data.map((ad) => {
      const stats = toTotals(insightByAd.get(ad.id));
      const creative = creativeFields(ad.creative);
      return {
        id: ad.id,
        name: ad.name,
        status: ad.effective_status,
        campaignId: ad.campaign_id ?? ad.campaign?.id ?? null,
        campaignName: ad.campaign?.name ?? null,
        adsetId: ad.adset_id ?? ad.adset?.id ?? null,
        adsetName: ad.adset?.name ?? null,
        thumbnailUrl: creative.thumbnailUrl,
        headline: creative.headline,
        body: creative.primaryText,
        spend: stats.spend,
        impressions: stats.impressions,
        clicks: stats.clicks,
        ctr: stats.ctr,
        leads: stats.leads,
        costPerLead: stats.costPerLead,
      };
    });
    liveAds.sort((a, b) => b.spend - a.spend);

    const insightLeadsByAd = new Map(
      [...insightByAd.entries()].map(([id, row]) => [id, leadsOf(row.actions)])
    );
    const leads = await fetchLeadsForAds(
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
      datePreset,
      totals: toTotals(totals.data[0]),
      daily: dailyPoints,
      campaigns: campaignItems,
      adSets: adSetItems,
      ads: adItems,
      leads,
      liveAds,
    };
  },
};
