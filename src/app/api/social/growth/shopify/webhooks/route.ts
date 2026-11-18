import { errorResponse } from '@/shared/server/http-error';
import { growthRequest } from '@/modules/social/server/growth/growth-http';
import { shopifyService } from '@/modules/social/server/growth/shopify.service';

/** @deprecated Prefer POST /shopify/webhooks/enable */
export async function POST() {
  try {
    const { gc } = await growthRequest('approve');
    return Response.json(await shopifyService.enableLiveEvents(gc.organizationId, gc.customerId));
  } catch (error) {
    return errorResponse(error);
  }
}

/** @deprecated Prefer POST /shopify/webhooks/disable */
export async function DELETE() {
  try {
    const { gc } = await growthRequest('approve');
    return Response.json(await shopifyService.disableLiveEvents(gc.organizationId, gc.customerId));
  } catch (error) {
    return errorResponse(error);
  }
}
