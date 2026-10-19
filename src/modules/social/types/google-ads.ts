import type {
  AdsAdItem,
  AdsAdSetItem,
  AdsCampaignItem,
  AdsDailyPoint,
  AdsTotals,
} from './ads';

export interface GoogleAdsAccountItem {
  /** Customer id, digits only (e.g. "1234567890"). */
  id: string;
  name: string;
  currency: string;
  timeZone: string;
  /** Google customer status, e.g. ENABLED, SUSPENDED, CANCELED. */
  status: string;
  /** Assigned Podo client, if any. */
  clientId: string | null;
}

export interface GoogleAdsConnectionSummary {
  connected: boolean;
  /** OAuth client id/secret and developer token are all set on the server. */
  configured: boolean;
  /** Which env vars are missing when `configured` is false. */
  missing: string[];
  email?: string;
  name?: string | null;
  picture?: string | null;
  lastSyncedAt?: string | null;
  /** Last account-discovery problem (e.g. developer token not approved). */
  lastError?: string | null;
}

export interface GoogleAdsStatusResponse {
  connection: GoogleAdsConnectionSummary;
  accounts: GoogleAdsAccountItem[];
}

/** Same shape the Meta overview uses, so tables and totals can share formatting. */
export interface GoogleAdsOverview {
  account: GoogleAdsAccountItem;
  since: string;
  until: string;
  totals: AdsTotals;
  daily: AdsDailyPoint[];
  campaigns: AdsCampaignItem[];
  /** Ad groups, mapped onto the ad-set shape. */
  adGroups: AdsAdSetItem[];
  ads: AdsAdItem[];
}
