import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { HttpError } from '@/shared/server/http-error';

export const RAZORPAY_PAID_EVENTS = new Set([
  'payment.captured',
  'order.paid',
  'subscription.activated',
  'subscription.charged',
]);

/** Charge retries exhausted — mark past_due and drop entitlements. */
export const RAZORPAY_HALT_EVENTS = new Set(['subscription.halted']);

/** Customer or dashboard cancelled the subscription. */
export const RAZORPAY_CANCEL_EVENTS = new Set(['subscription.cancelled']);

export type RazorpaySubscriptionStatus = 'active' | 'past_due' | 'cancelled';

/**
 * Maps a Razorpay webhook event name to the SocialSubscription status we apply.
 * Returns null when the event is ignored (no status change).
 */
export function subscriptionStatusForRazorpayEvent(
  event: string
): RazorpaySubscriptionStatus | null {
  if (RAZORPAY_HALT_EVENTS.has(event)) return 'past_due';
  if (RAZORPAY_CANCEL_EVENTS.has(event)) return 'cancelled';
  if (RAZORPAY_PAID_EVENTS.has(event)) return 'active';
  return null;
}

/** Verifies `X-Razorpay-Signature` (HMAC-SHA256 hex of the raw body). */
export function verifyRazorpayWebhookSignature(
  rawBody: string,
  signature: string | null,
  webhookSecret: string
): void {
  if (!signature) {
    throw new HttpError(401, 'Missing Razorpay signature');
  }
  const expected = createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new HttpError(401, 'Invalid Razorpay signature');
  }
}
