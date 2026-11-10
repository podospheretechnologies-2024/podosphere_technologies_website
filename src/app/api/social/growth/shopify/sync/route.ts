import { errorResponse, HttpError } from '@/shared/server/http-error';
import { growthRequest } from '@/modules/social/server/growth/growth-http';
import { shopifyService } from '@/modules/social/server/growth/shopify.service';
import { prisma } from '@/shared/lib/prisma';

/** Sync now (runs in the request so the user sees the result; the worker also syncs every 3 hours). */
export async function POST() {
  try {
    const { gc } = await growthRequest('draft');
    const store = await prisma.socialShopifyStore.findFirst({
      where: { organizationId: gc.organizationId, customerId: gc.customerId },
      select: { id: true },
    });
    if (!store) throw new HttpError(400, 'Connect the Shopify store first.');
    await shopifyService.syncStore(store.id);
    return Response.json(await shopifyService.get(gc.organizationId, gc.customerId));
  } catch (error) {
    return errorResponse(error);
  }
}
