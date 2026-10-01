export const ANALYTICS_RANGE_VALUES = ['7', '30', '90', '180', 'custom'] as const;

export type AnalyticsRange = (typeof ANALYTICS_RANGE_VALUES)[number];

export const ANALYTICS_RANGE_OPTIONS: readonly { value: AnalyticsRange; label: string }[] = [
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
  { value: '180', label: '6 months' },
  { value: 'custom', label: 'Custom' },
];

export const ANALYTICS_DEFAULT_RANGE: AnalyticsRange = '30';

/** Upper bound for a custom range; one extra day absorbs time zone offsets. */
export const ANALYTICS_MAX_RANGE_DAYS = 366;
