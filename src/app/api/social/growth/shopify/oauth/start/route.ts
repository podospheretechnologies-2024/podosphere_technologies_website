import type { NextRequest } from 'next/server';
import { errorResponse } from '@/shared/server/http-error';
import { growthRequest } from '@/modules/social/server/growth/growth-http';
import { shopifyOAuthStartSchema } from '@/modules/social/server/growth/growth.schema';
import { shopifyService } from '@/modules/social/server/growth/shopify.service';

/**
 * "Connect with Shopify": returns Shopify's approval page for the selected client's store.
 * For an app in the agency's Partner organisation installed on a client's store, where the
 * Client ID + secret login is refused.
 */
export async function POST(request: NextRequest) {
  try {
    const { gc, userId } = await growthRequest('approve');
    const input = shopifyOAuthStartSchema.parse(await request.json());
    return Response.json(await shopifyService.startOAuth(gc.organizationId, gc.customerId, userId, input));
  } catch (error) {
    return errorResponse(error);
  }
}
