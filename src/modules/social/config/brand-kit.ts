/** Brand kit fields, in display order. Podo AI reads them before writing anything. */
export const BRAND_KIT_FIELDS = [
  { key: 'brand_name', label: 'Brand name', placeholder: 'PodoSphere Technologies', long: false },
  { key: 'what_we_sell', label: 'What you sell', placeholder: 'Performance marketing for D2C brands', long: true },
  { key: 'audience', label: 'Audience', placeholder: 'Founders and marketing heads of Indian SMEs', long: true },
  { key: 'tone_of_voice', label: 'Tone of voice', placeholder: 'Confident, friendly, practical. No jargon.', long: false },
  { key: 'words_to_use', label: 'Words to use', placeholder: 'growth, ROI, results', long: false },
  { key: 'words_to_avoid', label: 'Words to avoid', placeholder: 'cheap, guaranteed, best in the world', long: false },
  { key: 'hashtag_style', label: 'Hashtag style', placeholder: '3–5 niche hashtags, no emoji spam', long: false },
  { key: 'languages', label: 'Languages', placeholder: 'English, Hinglish for Instagram', long: false },
  { key: 'example_posts', label: 'Example posts you liked', placeholder: 'Paste 1–3 posts', long: true },
  { key: 'faq_answers', label: 'Approved FAQ answers', placeholder: 'Pricing: starts at ₹25,000/month…', long: true },
  { key: 'compliance_notes', label: 'Compliance notes', placeholder: 'No income claims. Always add T&C for offers.', long: true },
] as const;

export const BRAND_KIT_FIELD_MAX_LENGTH = 4000;

export type BrandKitKey = (typeof BRAND_KIT_FIELDS)[number]['key'];
export type BrandKit = Record<BrandKitKey, string>;

export function emptyBrandKit(): BrandKit {
  return Object.fromEntries(BRAND_KIT_FIELDS.map((field) => [field.key, ''])) as BrandKit;
}
