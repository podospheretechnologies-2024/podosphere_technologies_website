import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { billingService } from '@/modules/social/server/billing/billing.service';
import { isPlanKey } from '@/modules/social/config/plans';
import { getCurrentOrganization } from '@/shared/server/current-organization';
import { requireRole } from '@/shared/server/access';
import { errorResponse, HttpError } from '@/shared/server/http-error';

export async function GET() {
  try {
    const organization = await getCurrentOrganization();
    await requireRole('ADMIN');
    return Response.json(await billingService.status(organization.id));
  } catch (error) {
    return errorResponse(error);
  }
}

const schema = z.object({
  plan: z.string(),
  /** Prefer Razorpay subscription when a plan id is mapped; otherwise order. */
  mode: z.enum(['order', 'subscription']).default('subscription'),
  buyerGstin: z.string().max(20).optional().nullable(),
  placeOfSupply: z.string().max(120).optional().nullable(),
});

export async function POST(request: NextRequest) {
  try {
    const organization = await getCurrentOrganization();
    const ctx = await requireRole('ADMIN');
    if (ctx.impersonatedBy) {
      throw new HttpError(403, 'Billing changes are not allowed while impersonating');
    }
    const body = schema.parse(await request.json());
    if (!isPlanKey(body.plan)) {
      throw new HttpError(400, 'Unknown plan');
    }
    const buyer = {
      buyerGstin: body.buyerGstin,
      placeOfSupply: body.placeOfSupply,
    };
    if (body.mode === 'order') {
      return Response.json(await billingService.createOrder(organization.id, body.plan, buyer));
    }
    return Response.json(
      await billingService.createSubscription(organization.id, body.plan, buyer)
    );
  } catch (error) {
    return errorResponse(error);
  }
}
