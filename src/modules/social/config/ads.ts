/** Date ranges offered on the Ads page (Meta Marketing API date_preset values). */
export const ADS_DATE_PRESETS = [
  { value: 'last_7d', label: '7 days' },
  { value: 'last_30d', label: '30 days' },
  { value: 'last_90d', label: '90 days' },
] as const;

export type AdsDatePreset = (typeof ADS_DATE_PRESETS)[number]['value'];

export const ADS_DEFAULT_DATE_PRESET: AdsDatePreset = 'last_30d';

/** Meta action types counted as a lead (lead forms, Messenger/Instagram lead forms, pixel leads). */
export const ADS_LEAD_ACTION_TYPES = [
  'lead',
  'onsite_conversion.lead_grouped',
  'offsite_conversion.fb_pixel_lead',
] as const;
