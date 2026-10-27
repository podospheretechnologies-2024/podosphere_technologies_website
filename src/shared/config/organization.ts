export const DEFAULT_ORGANIZATION = {
  name: 'Podosphere Technologies',
  slug: 'podosphere',
} as const;

/** Ads are available for every workspace so users can connect Meta / Google ads. */
export function canUseAds(_org?: { name?: string | null; slug?: string | null }): boolean {
  return true;
}
