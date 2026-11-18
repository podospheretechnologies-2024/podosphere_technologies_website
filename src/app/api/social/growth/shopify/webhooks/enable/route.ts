import { errorResponse } from '@/shared/server/http-error';
import { growthRequest } from '@/modules/social/server/growth/growth-http';
import { shopifyService } from '@/modules/social/server/growth/shopify.service';

/** Turn on live events: register SHOPIFY_ORDER_FLOW_TOPICS to /api/webhooks/shopify. */
export async function POST() {
  try {
    const { gc } = await growthRequest('approve');
    return Response.json(await shopifyService.enableLiveEvents(gc.organizationId, gc.customerId));
  } catch (error) {
    return errorResponse(error);
  }
}
