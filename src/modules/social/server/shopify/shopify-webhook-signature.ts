import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { HttpError } from '@/shared/server/http-error';

/**
 * Verifies Shopify `X-Shopify-Hmac-Sha256` (base64 HMAC-SHA256 of the raw body)
 * using the app / custom-app client secret.
 */
export function verifyShopifyWebhookSignature(
  rawBody: string | Buffer,
  hmacHeader: string | null,
  clientSecret: string
): void {
  if (!hmacHeader?.trim()) {
    throw new HttpError(401, 'Missing Shopify HMAC signature');
  }
  if (!clientSecret) {
    throw new HttpError(500, 'Shopify client secret is not configured for this store');
  }
  const digest = createHmac('sha256', clientSecret).update(rawBody).digest('base64');
  const a = Buffer.from(digest, 'utf8');
  const b = Buffer.from(hmacHeader.trim(), 'utf8');
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new HttpError(401, 'Invalid Shopify HMAC signature');
  }
}

/** Pure helper for unit tests / tooling — returns the expected base64 HMAC. */
export function shopifyWebhookHmac(rawBody: string | Buffer, clientSecret: string): string {
  return createHmac('sha256', clientSecret).update(rawBody).digest('base64');
}
