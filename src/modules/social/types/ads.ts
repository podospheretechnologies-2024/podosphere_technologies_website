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
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  leads: number;
  costPerLead: number | null;
}

export interface AdsOverview {
  account: AdAccountItem;
  datePreset: AdsDatePreset;
  totals: AdsTotals;
  daily: AdsDailyPoint[];
  campaigns: AdsCampaignItem[];
}
