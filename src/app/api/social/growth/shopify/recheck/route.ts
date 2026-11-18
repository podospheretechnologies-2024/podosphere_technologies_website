import { errorResponse } from '@/shared/server/http-error';
import { growthRequest } from '@/modules/social/server/growth/growth-http';
import { shopifyService } from '@/modules/social/server/growth/shopify.service';

/** Refresh granted scopes from Shopify and update the access ticks. */
export async function POST() {
  try {
    const { gc } = await growthRequest('approve');
    return Response.json(await shopifyService.recheckScopes(gc.organizationId, gc.customerId));
  } catch (error) {
    return errorResponse(error);
  }
}
