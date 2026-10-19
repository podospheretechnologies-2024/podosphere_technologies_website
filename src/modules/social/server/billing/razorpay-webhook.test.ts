import { createHmac } from 'node:crypto';
import { describe, it, expect, vi } from 'vitest';
import { HttpError } from '@/shared/server/http-error';
import {
  subscriptionStatusForRazorpayEvent,
  verifyRazorpayWebhookSignature,
} from './razorpay-webhook';

vi.mock('server-only', () => ({}));

describe('verifyRazorpayWebhookSignature', () => {
  const secret = 'rzp_test_webhook_secret';
  const body = '{"event":"payment.captured"}';

  function sign(raw: string, key = secret): string {
    return createHmac('sha256', key).update(raw).digest('hex');
  }

  it('accepts a valid signature', () => {
    expect(() => verifyRazorpayWebhookSignature(body, sign(body), secret)).not.toThrow();
  });

  it('rejects a missing signature', () => {
    expect(() => verifyRazorpayWebhookSignature(body, null, secret)).toThrow(HttpError);
    expect(() => verifyRazorpayWebhookSignature(body, null, secret)).toThrow(
      'Missing Razorpay signature'
    );
  });

  it('rejects an invalid signature', () => {
    expect(() => verifyRazorpayWebhookSignature(body, sign(body, 'other'), secret)).toThrow(
      'Invalid Razorpay signature'
    );
  });
});

describe('subscriptionStatusForRazorpayEvent', () => {
  it('maps paid events to active', () => {
    expect(subscriptionStatusForRazorpayEvent('payment.captured')).toBe('active');
    expect(subscriptionStatusForRazorpayEvent('order.paid')).toBe('active');
    expect(subscriptionStatusForRazorpayEvent('subscription.activated')).toBe('active');
    expect(subscriptionStatusForRazorpayEvent('subscription.charged')).toBe('active');
  });

  it('maps halted to past_due and cancelled to cancelled', () => {
    expect(subscriptionStatusForRazorpayEvent('subscription.halted')).toBe('past_due');
    expect(subscriptionStatusForRazorpayEvent('subscription.cancelled')).toBe('cancelled');
  });

  it('ignores unknown events', () => {
    expect(subscriptionStatusForRazorpayEvent('payment.failed')).toBeNull();
    expect(subscriptionStatusForRazorpayEvent('')).toBeNull();
  });
});
