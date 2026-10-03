/** Date ranges offered on the Ads page (Meta Marketing API date_preset values). */
export const ADS_DATE_PRESETS = [
  { value: 'last_7d', label: '7 days' },
  { value: 'last_30d', label: '30 days' },
  { value: 'last_90d', label: '90 days' },
] as const;

export type AdsDatePreset = (typeof ADS_DATE_PRESETS)[number]['value'];

export const ADS_DEFAULT_DATE_PRESET: AdsDatePreset = 'last_30d';

/** Status filter on the Ads page (client-side; Meta effective_status). */
export const ADS_STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
] as const;

export type AdsStatusFilter = (typeof ADS_STATUS_FILTERS)[number]['value'];

export const ADS_DEFAULT_STATUS_FILTER: AdsStatusFilter = 'all';

const PAUSED_STATUSES = new Set(['PAUSED', 'CAMPAIGN_PAUSED', 'ADSET_PAUSED']);

export function matchesAdsStatusFilter(status: string, filter: AdsStatusFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'active') return status === 'ACTIVE';
  return PAUSED_STATUSES.has(status);
}

/** Meta action types counted as a lead (lead forms, Messenger/Instagram lead forms, pixel leads). */
export const ADS_LEAD_ACTION_TYPES = [
  'lead',
  'onsite_conversion.lead_grouped',
  'offsite_conversion.fb_pixel_lead',
] as const;
