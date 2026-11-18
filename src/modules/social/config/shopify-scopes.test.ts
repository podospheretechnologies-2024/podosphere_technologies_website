import { describe, expect, it } from 'vitest';
import {
  SHOPIFY_ALL_SCOPES,
  SHOPIFY_LIVE_EVENT_SCOPES,
  SHOPIFY_SCOPE_STRING,
  hasShopifyScope,
} from './shopify-scopes';

describe('shopify scopes', () => {
  it('matches the list in PODO_SHOPIFY_PERMISSIONS_PLAN.md', () => {
    expect([...SHOPIFY_ALL_SCOPES].sort()).toEqual(
      [
        'read_orders',
        'read_all_orders',
        'read_customers',
        'read_products',
        'read_inventory',
        'read_locations',
        'read_discounts',
        'read_reports',
        'read_content',
        'write_content',
        'read_fulfillments',
        'read_returns',
        'read_marketing_events',
        'read_files',
        'read_publications',
      ].sort()
    );
    expect(SHOPIFY_SCOPE_STRING.split(',')).toHaveLength(15);
  });

  it('has no duplicates and only one write permission', () => {
    expect(new Set(SHOPIFY_ALL_SCOPES).size).toBe(SHOPIFY_ALL_SCOPES.length);
    expect(SHOPIFY_ALL_SCOPES.filter((s) => s.startsWith('write_'))).toEqual(['write_content']);
  });

  it('keeps live events tied to the four core permissions only', () => {
    expect([...SHOPIFY_LIVE_EVENT_SCOPES]).toEqual(['read_orders', 'read_fulfillments', 'read_customers', 'read_products']);
  });

  it('counts a read permission as granted when its write twin is granted', () => {
    expect(hasShopifyScope(['write_content'], 'read_content')).toBe(true);
    expect(hasShopifyScope(['read_content'], 'write_content')).toBe(false);
    expect(hasShopifyScope(['read_orders'], 'read_all_orders')).toBe(false);
  });
});
