export const DEFAULT_ORGANIZATION = {
  name: 'Podosphere Technologies',
  slug: 'podosphere',
} as const;

/** Ads stay on the PodoSphere workspace. Names differ by capitalisation and "Pvt Ltd". */
export function canUseAds(org: { name?: string | null; slug?: string | null }): boolean {
  const slug = org.slug?.trim().toLowerCase() ?? '';
  if (slug === DEFAULT_ORGANIZATION.slug) return true;
  const name = (org.name ?? '')
    .toLowerCase()
    .replace(/pvt\.?\s*ltd\.?/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  return name === 'podosphere technologies' || name.startsWith('podosphere technologies');
}
