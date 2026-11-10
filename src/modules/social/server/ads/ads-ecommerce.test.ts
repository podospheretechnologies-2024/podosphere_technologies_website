import { describe, expect, it } from 'vitest';
import { ecommerceFromInsight, firstActionNumber, PURCHASE_ACTION_TYPES } from './ads-ecommerce';

describe('ecommerceFromInsight', () => {
  it('takes omni_purchase first and does not double count overlapping types', () => {
    const result = ecommerceFromInsight({
      actions: [
        { action_type: 'purchase', value: '4' },
        { action_type: 'omni_purchase', value: '5' },
        { action_type: 'offsite_conversion.fb_pixel_purchase', value: '4' },
        { action_type: 'omni_add_to_cart', value: '31' },
        { action_type: 'add_to_cart', value: '30' },
      ],
      action_values: [
        { action_type: 'purchase', value: '4100.50' },
        { action_type: 'omni_purchase', value: '5230.255' },
      ],
    });
    expect(result).toEqual({ purchases: 5, purchaseValue: 5230.26, addToCart: 31 });
  });

  it('falls back to pixel purchase and returns zeros when nothing is reported', () => {
    expect(
      firstActionNumber([{ action_type: 'offsite_conversion.fb_pixel_purchase', value: '2' }], PURCHASE_ACTION_TYPES)
    ).toBe(2);
    expect(ecommerceFromInsight({})).toEqual({ purchases: 0, purchaseValue: 0, addToCart: 0 });
  });

  it('ignores non-numeric values', () => {
    expect(firstActionNumber([{ action_type: 'purchase', value: 'n/a' }], PURCHASE_ACTION_TYPES)).toBe(0);
  });
});
