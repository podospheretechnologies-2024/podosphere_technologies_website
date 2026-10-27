import type { AdsDatePreset } from '../config/ads';

export interface AdAccountItem {
  /** Graph id, e.g. "act_623028240126874". */
  id: string;
  name: string;
  currency: string;
  /** 1 = active; anything else is disabled, unsettled, closed, … */
  status: number;
  amountSpent: number;
  /** True when an encrypted per-account Meta token is stored (never expose the token). */
  hasToken: boolean;
  /** True when Graph rejected the stored token; agency must set a new one. */
  refreshNeeded: boolean;
}

export interface AdsTotals {
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  /** Percent, e.g. 0.52 means 0.52%. */
  ctr: number;
  cpc: number;
  leads: number;
  costPerLead: number | null;
}

export interface AdsDailyPoint {
  date: string;
  spend: number;
  clicks: number;
}

export interface AdsCampaignItem {
  id: string;
  name: string;
  /** Effective status from Meta, e.g. ACTIVE, PAUSED, CAMPAIGN_PAUSED, WITH_ISSUES. */
  status: string;
  objective: string;
  /** Human-readable budget, e.g. "₹300.00 Daily" or null when set on ad sets. */
  budgetLabel: string | null;
  budgetAmount: number | null;
  budgetType: 'daily' | 'lifetime' | null;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  leads: number;
  costPerLead: number | null;
  landingPageViews: number;
  reach: number | null;
  frequency: number | null;
  cpm: number | null;
  linkClicks: number | null;
  startsAt: string | null;
  endsAt: string | null;
  attributionLabel: string | null;
  bidStrategyLabel: string | null;
  recommendations: number;
}

export interface AdsAdSetTargeting {
  ageMin: number | null;
  ageMax: number | null;
  locations: string[];
  interests: string[];
  behaviors: string[];
}

export interface AdsAdSetItem {
  id: string;
  name: string;
  status: string;
  campaignId: string | null;
  campaignName: string | null;
  targeting: AdsAdSetTargeting;
  spend: number;
  impressions: number | null;
  clicks: number | null;
  reach: number | null;
  frequency: number | null;
  cpm: number | null;
  ctr: number | null;
  cpc: number | null;
  leads: number;
  costPerLead: number | null;
  startsAt: string | null;
  endsAt: string | null;
  attributionLabel: string | null;
  bidStrategyLabel: string | null;
  recommendations: number;
}

export interface AdsAdItem {
  id: string;
  name: string;
  status: string;
  campaignId: string | null;
  campaignName: string | null;
  adsetId: string | null;
  adsetName: string | null;
  thumbnailUrl: string | null;
  /** Primary text / body copy. */
  primaryText: string | null;
  headline: string | null;
  description: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  leads: number;
  costPerLead: number | null;
  reach: number | null;
  frequency: number | null;
  cpm: number | null;
  linkClicks: number | null;
  startsAt: string | null;
  endsAt: string | null;
  attributionLabel: string | null;
  bidStrategyLabel: string | null;
  recommendations: number;
}

export const ADS_REPORT_BREAKDOWNS = [
  { value: 'none', label: 'No breakdown', graph: [] as const },
  { value: 'age', label: 'Age', graph: ['age'] as const },
  { value: 'gender', label: 'Gender', graph: ['gender'] as const },
  { value: 'age_gender', label: 'Age and gender', graph: ['age', 'gender'] as const },
  { value: 'country', label: 'Country', graph: ['country'] as const },
  {
    value: 'placement',
    label: 'Placement',
    graph: ['publisher_platform', 'platform_position'] as const,
  },
  { value: 'device', label: 'Device', graph: ['impression_device'] as const },
] as const;

export type AdsReportBreakdown = (typeof ADS_REPORT_BREAKDOWNS)[number]['value'];
export type AdsReportLevel = 'campaign' | 'adset' | 'ad';

export interface AdsReportRow {
  entityId: string;
  entityName: string;
  breakdownLabel: string;
  age: string | null;
  gender: string | null;
  country: string | null;
  publisherPlatform: string | null;
  platformPosition: string | null;
  device: string | null;
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  leads: number;
  ctr: number;
  cpc: number;
  previous: {
    spend: number;
    impressions: number;
    clicks: number;
    leads: number;
  } | null;
}

export interface AdsReportResult {
  level: AdsReportLevel;
  breakdown: AdsReportBreakdown;
  since: string | null;
  until: string | null;
  datePreset: string | null;
  compareSince: string | null;
  compareUntil: string | null;
  rows: AdsReportRow[];
}

export type AdsEntityKind = 'ad' | 'campaign' | 'adset' | 'lead';

export interface AdsHistoryPoint {
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  leads: number;
}

export interface AdsEntityHistory {
  kind: Exclude<AdsEntityKind, 'lead'>;
  id: string;
  totals: AdsTotals;
  history: AdsHistoryPoint[];
}

/** A currently serving ad (effective_status ACTIVE). */
export interface AdsLiveAd {
  id: string;
  name: string;
  status: string;
  campaignId: string | null;
  campaignName: string | null;
  adsetId: string | null;
  adsetName: string | null;
  thumbnailUrl: string | null;
  headline: string | null;
  body: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  leads: number;
  costPerLead: number | null;
}

export interface AdsLeadItem {
  id: string;
  createdTime: string;
  adId: string | null;
  adName: string | null;
  adsetId: string | null;
  adsetName: string | null;
  campaignId: string | null;
  campaignName: string | null;
  formId: string | null;
  /** Flattened lead form answers, e.g. "email: a@b.com". */
  fields: { name: string; values: string[] }[];
}

export interface AdsAudienceItem {
  id: string;
  name: string;
  subtype: string;
  sizeLower: number | null;
  sizeUpper: number | null;
  operationStatus: string | null;
  deliveryStatus: string | null;
  createdTime: string | null;
  updatedTime: string | null;
}

export interface AdsProductSetItem {
  id: string;
  name: string;
  productCount: number | null;
}

export interface AdsCatalogItem {
  id: string;
  name: string;
  vertical: string | null;
  productCount: number | null;
  feedCount: number | null;
  productSets: AdsProductSetItem[];
}

export interface AdsCatalogsResult {
  businessId: string | null;
  businessName: string | null;
  catalogs: AdsCatalogItem[];
}

export interface AdsOverview {
  account: AdAccountItem;
  /** Present when the request used a Meta date_preset. */
  datePreset: AdsDatePreset | null;
  /** Present when the request used a custom since/until range. */
  since: string | null;
  until: string | null;
  totals: AdsTotals;
  daily: AdsDailyPoint[];
  campaigns: AdsCampaignItem[];
  adSets: AdsAdSetItem[];
  ads: AdsAdItem[];
  leads: AdsLeadItem[];
  /** Ads that are live / currently eligible to serve. */
  liveAds: AdsLiveAd[];
}
