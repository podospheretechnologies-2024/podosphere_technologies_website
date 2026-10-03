import type { AdsDatePreset } from '../config/ads';

export interface AdAccountItem {
  /** Graph id, e.g. "act_623028240126874". */
  id: string;
  name: string;
  currency: string;
  /** 1 = active; anything else is disabled, unsettled, closed, … */
  status: number;
  amountSpent: number;
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
  leads: number;
  costPerLead: number | null;
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
