import { errorResponse } from '@/shared/server/http-error';
import { growthRequest } from '@/modules/social/server/growth/growth-http';
import { shopifyService } from '@/modules/social/server/growth/shopify.service';

/** Turn off live events: unregister our Shopify webhooks. */
export async function POST() {
  try {
    const { gc } = await growthRequest('approve');
    return Response.json(await shopifyService.disableLiveEvents(gc.organizationId, gc.customerId));
  } catch (error) {
    return errorResponse(error);
  }
}
