import { describe, it, expect, vi } from 'vitest';
import { HttpError } from '@/shared/server/http-error';
import {
  shopifyWebhookHmac,
  verifyShopifyWebhookSignature,
} from './shopify-webhook-signature';

vi.mock('server-only', () => ({}));

describe('verifyShopifyWebhookSignature', () => {
  const secret = 'shpss_test_client_secret';
  const body = '{"id":1042,"email":"priya@example.com"}';

  it('accepts a valid X-Shopify-Hmac-Sha256', () => {
    expect(() =>
      verifyShopifyWebhookSignature(body, shopifyWebhookHmac(body, secret), secret)
    ).not.toThrow();
  });

  it('rejects a missing header', () => {
    expect(() => verifyShopifyWebhookSignature(body, null, secret)).toThrow(HttpError);
    expect(() => verifyShopifyWebhookSignature(body, null, secret)).toThrow(
      'Missing Shopify HMAC signature'
    );
  });

  it('rejects a wrong signature', () => {
    expect(() =>
      verifyShopifyWebhookSignature(body, shopifyWebhookHmac(body, 'other'), secret)
    ).toThrow('Invalid Shopify HMAC signature');
  });

  it('rejects a tampered body', () => {
    const header = shopifyWebhookHmac(body, secret);
    expect(() => verifyShopifyWebhookSignature(body + ' ', header, secret)).toThrow(
      'Invalid Shopify HMAC signature'
    );
  });
});
