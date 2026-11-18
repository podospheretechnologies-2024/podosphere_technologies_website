import { createHmac } from 'node:crypto';
import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/shared/lib/env', () => ({ getServerEnv: () => ({ SHOPIFY_API_VERSION: '2026-07' }) }));

let buildShopifyAuthorizeUrl: typeof import('./shopify.client').buildShopifyAuthorizeUrl;
let verifyShopifyOAuthHmac: typeof import('./shopify.client').verifyShopifyOAuthHmac;

beforeAll(async () => {
  ({ buildShopifyAuthorizeUrl, verifyShopifyOAuthHmac } = await import('./shopify.client'));
});

const SECRET = 'shpss_test_secret';

/** Signs the way Shopify does: sorted `key=value` pairs joined with `&`, hex HMAC-SHA256. */
function signed(entries: Record<string, string>, secret = SECRET): URLSearchParams {
  const message = Object.keys(entries)
    .sort()
    .map((key) => `${key}=${entries[key]}`)
    .join('&');
  const hmac = createHmac('sha256', secret).update(message, 'utf8').digest('hex');
  return new URLSearchParams({ ...entries, hmac });
}

const CALLBACK = {
  code: 'abc123',
  shop: 'demo-store.myshopify.com',
  state: 'nonce-1',
  timestamp: '1795600000',
  host: 'YWRtaW4uc2hvcGlmeS5jb20vc3RvcmUvZGVtbw',
};

describe('verifyShopifyOAuthHmac', () => {
  it('accepts a redirect signed with the app secret, whatever the parameter order', () => {
    expect(verifyShopifyOAuthHmac(signed(CALLBACK), SECRET)).toBe(true);
    const reordered = new URLSearchParams([...signed(CALLBACK).entries()].reverse());
    expect(verifyShopifyOAuthHmac(reordered, SECRET)).toBe(true);
  });

  it('rejects a changed parameter', () => {
    const params = signed(CALLBACK);
    params.set('shop', 'attacker.myshopify.com');
    expect(verifyShopifyOAuthHmac(params, SECRET)).toBe(false);
  });

  it('rejects an added parameter', () => {
    const params = signed(CALLBACK);
    params.set('extra', '1');
    expect(verifyShopifyOAuthHmac(params, SECRET)).toBe(false);
  });

  it('rejects another secret, a missing hmac and a malformed hmac', () => {
    expect(verifyShopifyOAuthHmac(signed(CALLBACK, 'other-secret'), SECRET)).toBe(false);
    expect(verifyShopifyOAuthHmac(new URLSearchParams(CALLBACK), SECRET)).toBe(false);
    expect(verifyShopifyOAuthHmac(new URLSearchParams({ ...CALLBACK, hmac: 'zz' }), SECRET)).toBe(false);
  });
});

describe('buildShopifyAuthorizeUrl', () => {
  it('points at the store and carries the client id, scopes, redirect and state', () => {
    const url = new URL(
      buildShopifyAuthorizeUrl({
        shopDomain: 'demo-store.myshopify.com',
        clientId: 'client-1',
        scopes: ['read_orders', 'read_products'],
        redirectUri: 'https://app.example.com/api/social/growth/shopify/oauth/callback',
        state: 'nonce-1',
      })
    );
    expect(url.origin).toBe('https://demo-store.myshopify.com');
    expect(url.pathname).toBe('/admin/oauth/authorize');
    expect(url.searchParams.get('client_id')).toBe('client-1');
    expect(url.searchParams.get('scope')).toBe('read_orders,read_products');
    expect(url.searchParams.get('redirect_uri')).toBe('https://app.example.com/api/social/growth/shopify/oauth/callback');
    expect(url.searchParams.get('state')).toBe('nonce-1');
    expect(url.search).not.toContain('client_secret');
  });
});
