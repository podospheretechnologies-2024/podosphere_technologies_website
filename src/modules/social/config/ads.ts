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

export function isPausedAdsStatus(status: string): boolean {
  return PAUSED_STATUSES.has(status);
}

export function previousAdsRange(
  date:
    | { mode: 'preset'; datePreset: AdsDatePreset }
    | { mode: 'range'; since: string; until: string },
  now = new Date()
): { since: string; until: string } {
  const ymd = (value: Date) => value.toISOString().slice(0, 10);
  if (date.mode === 'range') {
    const start = new Date(`${date.since}T00:00:00.000Z`);
    const end = new Date(`${date.until}T00:00:00.000Z`);
    const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1);
    const prevEnd = new Date(start);
    prevEnd.setUTCDate(prevEnd.getUTCDate() - 1);
    const prevStart = new Date(prevEnd);
    prevStart.setUTCDate(prevStart.getUTCDate() - (days - 1));
    return { since: ymd(prevStart), until: ymd(prevEnd) };
  }
  const days = date.datePreset === 'last_7d' ? 7 : date.datePreset === 'last_90d' ? 90 : 30;
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const until = new Date(today);
  until.setUTCDate(until.getUTCDate() - days);
  const since = new Date(until);
  since.setUTCDate(since.getUTCDate() - (days - 1));
  return { since: ymd(since), until: ymd(until) };
}
