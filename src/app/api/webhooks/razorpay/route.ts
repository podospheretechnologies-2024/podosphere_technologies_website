import type { NextRequest } from 'next/server';
import { billingService } from '@/modules/social/server/billing/billing.service';
import { errorResponse } from '@/shared/server/http-error';

/**
 * Razorpay billing webhooks → SocialSubscription status.
 * Subscribe in the Razorpay dashboard (see docs/ops-runbook.md § Razorpay):
 * payment.captured, order.paid, subscription.activated, subscription.charged,
 * subscription.halted, subscription.cancelled.
 */
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    billingService.verifyWebhook(rawBody, request.headers.get('x-razorpay-signature'));
    const payload = JSON.parse(rawBody) as Parameters<typeof billingService.applyWebhook>[0];
    return Response.json(await billingService.applyWebhook(payload));
  } catch (error) {
    return errorResponse(error);
  }
}
