import { createHmac } from 'node:crypto';
import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/shared/lib/env', () => ({ getServerEnv: () => ({ SHOPIFY_API_VERSION: '2026-07' }) }));

let verifyShopifyWebhookHmac: typeof import('./shopify.client').verifyShopifyWebhookHmac;

beforeAll(async () => {
  ({ verifyShopifyWebhookHmac } = await import('./shopify.client'));
});

function sign(body: string, secret: string): string {
  return createHmac('sha256', secret).update(body, 'utf8').digest('base64');
}

describe('verifyShopifyWebhookHmac', () => {
  it('accepts a valid base64 HMAC', () => {
    const body = '{"id":1,"name":"#1001"}';
    const secret = 'shpss_test_secret';
    expect(verifyShopifyWebhookHmac(body, sign(body, secret), secret)).toBe(true);
  });

  it('rejects a bad signature or missing header', () => {
    const body = '{"id":1}';
    expect(verifyShopifyWebhookHmac(body, 'nope', 'secret')).toBe(false);
    expect(verifyShopifyWebhookHmac(body, null, 'secret')).toBe(false);
  });
});
