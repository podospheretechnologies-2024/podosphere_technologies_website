/**
 * Permissions the "Podo Social" Shopify app asks for. One list, shared by the connect screen,
 * the setup guide and the server access check. Source: PODO_SHOPIFY_PERMISSIONS_PLAN.md.
 *
 * Groups:
 *  - core:   live order events + WhatsApp order flows. Missing one blocks "Turn on live events".
 *  - growth: Growth desk numbers and blogs.
 *  - extra:  marketing data ticked now so the app is not reinstalled later. Never blocks anything.
 */
export type ShopifyAccessGroup = 'core' | 'growth' | 'extra';

export interface ShopifyAccessCheckDef {
  key: string;
  label: string;
  group: ShopifyAccessGroup;
  scopes: readonly string[];
  /** False while the dashboard does not read this data yet. */
  inUse: boolean;
}

export const SHOPIFY_ACCESS_CHECKS: readonly ShopifyAccessCheckDef[] = [
  { key: 'orders', label: 'Orders', group: 'core', scopes: ['read_orders'], inUse: true },
  { key: 'shipping', label: 'Shipping', group: 'core', scopes: ['read_fulfillments'], inUse: true },
  { key: 'customers', label: 'Customers', group: 'core', scopes: ['read_customers'], inUse: true },
  { key: 'products', label: 'Products', group: 'core', scopes: ['read_products'], inUse: true },
  { key: 'analytics', label: 'Store analytics', group: 'growth', scopes: ['read_reports'], inUse: true },
  { key: 'blogs', label: 'Blogs', group: 'growth', scopes: ['read_content', 'write_content'], inUse: true },
  { key: 'older_orders', label: 'Orders older than 60 days', group: 'extra', scopes: ['read_all_orders'], inUse: false },
  { key: 'stock', label: 'Stock', group: 'extra', scopes: ['read_inventory', 'read_locations'], inUse: false },
  { key: 'coupons', label: 'Coupon codes', group: 'extra', scopes: ['read_discounts'], inUse: false },
  { key: 'returns', label: 'Returns', group: 'extra', scopes: ['read_returns'], inUse: false },
  { key: 'marketing', label: 'Marketing activity', group: 'extra', scopes: ['read_marketing_events'], inUse: false },
  { key: 'files', label: 'Photos and videos', group: 'extra', scopes: ['read_files'], inUse: false },
  { key: 'channels', label: 'Sales channels', group: 'extra', scopes: ['read_publications'], inUse: false },
];

const scopesOf = (group: ShopifyAccessGroup): string[] =>
  SHOPIFY_ACCESS_CHECKS.filter((row) => row.group === group).flatMap((row) => [...row.scopes]);

export const SHOPIFY_LIVE_EVENT_SCOPES: readonly string[] = scopesOf('core');
export const SHOPIFY_GROWTH_SCOPES: readonly string[] = scopesOf('growth');
/** Every permission to tick on the app. */
export const SHOPIFY_ALL_SCOPES: readonly string[] = SHOPIFY_ACCESS_CHECKS.flatMap((row) => [...row.scopes]);
/**
 * Shopify's app form rejects these as "invalid scopes" until Shopify has approved them for the
 * app (Dev Dashboard access request). They are checked, but kept out of the paste list.
 */
export const SHOPIFY_APPROVAL_SCOPES: readonly string[] = ['read_all_orders'];
/** Scopes that can be pasted in the app's access list straight away. */
export const SHOPIFY_PASTE_SCOPES: readonly string[] = SHOPIFY_ALL_SCOPES.filter((s) => !SHOPIFY_APPROVAL_SCOPES.includes(s));
/** Comma-separated list, ready to paste in the app's access list. */
export const SHOPIFY_SCOPE_STRING = SHOPIFY_PASTE_SCOPES.join(',');

/**
 * Shopify leaves out `read_x` from the granted list when `write_x` was granted, because write
 * includes read. So a read permission counts as granted when its write twin is there.
 */
export function hasShopifyScope(granted: readonly string[], scope: string): boolean {
  if (granted.includes(scope)) return true;
  return scope.startsWith('read_') && granted.includes(`write_${scope.slice('read_'.length)}`);
}
