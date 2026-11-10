/**
 * Groups unassigned channels / ad accounts into suggested clients by name.
 *
 * "heritageweves" (Instagram), "Heritage Weves" (Facebook page) and "Heritage Weves Ads" (Meta ad
 * account) all reduce to the key "heritageweves", so they land in one suggestion. Pure functions —
 * no database — so the matching rules are unit-tested on their own.
 */

export type GroupableKind = 'channel' | 'meta_ad' | 'google_ad';

export interface GroupableAsset {
  kind: GroupableKind;
  /** Integration id, Meta `act_…` id or Google Ads customer id. */
  id: string;
  name: string;
  /** Instagram handle / page username when known; matched as well as the display name. */
  username?: string | null;
  provider?: string | null;
}

export interface ClientRef {
  id: string;
  name: string;
}

export interface AssetGroup {
  key: string;
  /** Best human-readable name for a new client. */
  suggestedName: string;
  /** Existing client whose name matches the group, if any. */
  clientId: string | null;
  assets: GroupableAsset[];
}

// Trailing words that say nothing about the brand. Order matters only for readability; they are
// stripped repeatedly until none is left.
const NOISE_SUFFIXES = [
  'officialpage',
  'official',
  'adaccount',
  'account',
  'ads',
  'ad',
  'india',
  'store',
  'shop',
  'page',
  'privatelimited',
  'pvtltd',
  'pvt',
  'ltd',
  'llp',
  'inc',
];

const MIN_KEY_LENGTH = 3;

/** Lower-case alphanumeric brand key: "Ziply5 Official Ads" → "ziply5", "seere.india" → "seere". */
export function brandKey(raw: string): string {
  let text = raw.toLowerCase().trim();
  text = text.replace(/^@/, '');
  // Domain-style handles: "francoleone.in", "brand.co.in", "brand.com".
  text = text.replace(/\.(co\.in|in|com|co|store|shop|online)$/, '');
  let key = text.replace(/[^a-z0-9]/g, '');
  let changed = true;
  while (changed) {
    changed = false;
    for (const suffix of NOISE_SUFFIXES) {
      if (key.endsWith(suffix) && key.length - suffix.length >= MIN_KEY_LENGTH) {
        key = key.slice(0, -suffix.length);
        changed = true;
      }
    }
  }
  return key;
}

function titleCase(value: string): string {
  return value
    .split(/[\s._-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/** Prefer a name a person typed ("Heritage Weves") over a handle ("heritageweves"). */
function pickDisplayName(assets: GroupableAsset[]): string {
  const human = assets
    .map((asset) => asset.name.trim())
    .filter((name) => /\s/.test(name) || /[A-Z]/.test(name))
    .map((name) => name.replace(/\s+(official|ads?|ad account|account|page)$/i, '').trim())
    .filter(Boolean);
  if (human.length > 0) return human.sort((a, b) => a.length - b.length)[0];
  const handle = (assets[0]?.name ?? '').replace(/^@/, '').replace(/\.(co\.in|in|com|co)$/i, '');
  const trimmed = handle.replace(/([._\s-]?(official|india|store|ads?))+$/i, '');
  return titleCase(trimmed.length >= MIN_KEY_LENGTH ? trimmed : handle);
}

/** True when one key is the other plus a few trailing characters ("houseofvayni" vs "houseofvaynijaipur"). */
function keysRelated(a: string, b: string): boolean {
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return short.length >= 5 && long.startsWith(short);
}

export function groupAssets(assets: GroupableAsset[], clients: ClientRef[]): AssetGroup[] {
  const byKey = new Map<string, GroupableAsset[]>();

  for (const asset of assets) {
    // Match on the handle when the display name is generic (e.g. an ad account named by its id).
    const nameKey = brandKey(asset.name);
    const handleKey = asset.username ? brandKey(asset.username) : '';
    const key = nameKey.length >= MIN_KEY_LENGTH && !/^\d+$/.test(nameKey) ? nameKey : handleKey || nameKey;
    const existing = [...byKey.keys()].find((other) => keysRelated(other, key) || (handleKey && keysRelated(other, handleKey)));
    const target = existing ?? key;
    if (existing && key.length < existing.length) {
      // Keep the shorter key as the group key so later assets match it.
      byKey.set(key, [...(byKey.get(existing) ?? []), asset]);
      byKey.delete(existing);
      continue;
    }
    byKey.set(target, [...(byKey.get(target) ?? []), asset]);
  }

  const clientKeys = clients.map((client) => ({ ...client, key: brandKey(client.name) }));

  return [...byKey.entries()]
    .map(([key, groupAssetsList]) => {
      const client = clientKeys.find((c) => c.key.length >= MIN_KEY_LENGTH && keysRelated(c.key, key));
      return {
        key,
        suggestedName: client?.name ?? pickDisplayName(groupAssetsList),
        clientId: client?.id ?? null,
        assets: groupAssetsList,
      };
    })
    .sort((a, b) => b.assets.length - a.assets.length || a.suggestedName.localeCompare(b.suggestedName));
}
