/**
 * Purchases, purchase value and add-to-cart from a Meta insights row.
 *
 * Meta reports the same purchase under several action types (omni_purchase, purchase,
 * offsite_conversion.fb_pixel_purchase …). They overlap, so we take the FIRST type present in
 * priority order instead of summing them — summing would double count.
 */
export const PURCHASE_ACTION_TYPES = [
  'omni_purchase',
  'purchase',
  'offsite_conversion.fb_pixel_purchase',
  'onsite_web_purchase',
] as const;

export const ADD_TO_CART_ACTION_TYPES = [
  'omni_add_to_cart',
  'add_to_cart',
  'offsite_conversion.fb_pixel_add_to_cart',
  'onsite_web_add_to_cart',
] as const;

interface ActionLike {
  action_type: string;
  value: string;
}

export function firstActionNumber(
  actions: readonly ActionLike[] | undefined,
  types: readonly string[]
): number {
  if (!actions?.length) return 0;
  for (const type of types) {
    const match = actions.find((action) => action.action_type === type);
    if (match) {
      const value = Number.parseFloat(match.value);
      return Number.isFinite(value) ? value : 0;
    }
  }
  return 0;
}

export function ecommerceFromInsight(row: {
  actions?: readonly ActionLike[];
  action_values?: readonly ActionLike[];
}): { purchases: number; purchaseValue: number; addToCart: number } {
  return {
    purchases: Math.round(firstActionNumber(row.actions, PURCHASE_ACTION_TYPES)),
    purchaseValue: Math.round(firstActionNumber(row.action_values, PURCHASE_ACTION_TYPES) * 100) / 100,
    addToCart: Math.round(firstActionNumber(row.actions, ADD_TO_CART_ACTION_TYPES)),
  };
}
