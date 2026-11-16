export const OPS_CLIENT_STATUSES = [
  'not_started',
  'in_progress',
  'active',
  'on_hold',
  'completed',
  'lost',
] as const;

export type OpsClientStatus = (typeof OPS_CLIENT_STATUSES)[number];

export const OPS_CLIENT_STATUS_LABEL: Record<OpsClientStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  active: 'Active',
  on_hold: 'On hold',
  completed: 'Completed',
  lost: 'Lost',
};

export const OPS_ENGAGEMENT_TYPES = ['retainer', 'one_time', 'project'] as const;
export type OpsEngagementType = (typeof OPS_ENGAGEMENT_TYPES)[number];

export const OPS_SERVICE_CATEGORIES = [
  'website',
  'social_media',
  'paid_ads',
  'ecommerce',
  'quick_commerce',
] as const;

export type OpsServiceCategory = (typeof OPS_SERVICE_CATEGORIES)[number];

export const OPS_SERVICE_CATEGORY_LABEL: Record<OpsServiceCategory, string> = {
  website: 'Website',
  social_media: 'Social Media',
  paid_ads: 'Paid Ads',
  ecommerce: 'E-Commerce',
  quick_commerce: 'Quick Commerce',
};

/** Suggested subtypes shown in the Services UI (free-form still allowed). */
export const OPS_SERVICE_SUBTYPES: Record<
  OpsServiceCategory,
  { groupLabel: string; subtypes: string[] }[]
> = {
  website: [
    {
      groupLabel: 'Dev',
      subtypes: ['Shopify, WordPress', 'Coded', 'Website Management'],
    },
  ],
  social_media: [
    {
      groupLabel: 'Platforms',
      subtypes: ['Instagram', 'Facebook', 'YouTube', 'Twitter', 'Pinterest'],
    },
    {
      groupLabel: 'Client type',
      subtypes: ['Basic Posting', 'Content Marketing'],
    },
  ],
  paid_ads: [
    { groupLabel: 'Channels', subtypes: ['Meta Ads', 'Google Ads'] },
  ],
  ecommerce: [
    { groupLabel: 'Scope', subtypes: ['Onboarding', 'Management'] },
    {
      groupLabel: 'Platforms',
      subtypes: ['Amazon', 'Flipkart', 'Myntra', 'Nykaa', 'JioMart', 'Ajio'],
    },
  ],
  quick_commerce: [
    { groupLabel: 'Scope', subtypes: ['Onboarding', 'Management'] },
    {
      groupLabel: 'Platforms',
      subtypes: ['Blinkit', 'Zepto', 'Instamart', 'BigBasket'],
    },
  ],
};

export function monthKeyFromDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function parseMonthKey(monthKey: string): { year: number; month: number } {
  const [y, m] = monthKey.split('-').map(Number);
  return { year: y, month: m };
}

export function monthLabel(monthKey: string): string {
  const { year, month } = parseMonthKey(monthKey);
  const date = new Date(Date.UTC(year, month - 1, 1));
  return date.toLocaleString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export function addMonthsToKey(monthKey: string, delta: number): string {
  const { year, month } = parseMonthKey(monthKey);
  const d = new Date(Date.UTC(year, month - 1 + delta, 1));
  return monthKeyFromDate(d);
}

export function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function daysFromToday(date: Date | null | undefined): number | null {
  if (!date) return null;
  const today = startOfUtcDay(new Date());
  const target = startOfUtcDay(date);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}
