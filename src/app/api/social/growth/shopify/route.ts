import type { NextRequest } from 'next/server';
import { errorResponse } from '@/shared/server/http-error';
import { growthRequest } from '@/modules/social/server/growth/growth-http';
import { shopifyConnectSchema } from '@/modules/social/server/growth/growth.schema';
import { shopifyService } from '@/modules/social/server/growth/shopify.service';
import { enqueueStoreSync } from '@/modules/social/server/growth/growth.queue';
import { prisma } from '@/shared/lib/prisma';

export async function GET() {
  try {
    const { gc } = await growthRequest('view');
    return Response.json(await shopifyService.get(gc.organizationId, gc.customerId));
  } catch (error) {
    return errorResponse(error);
  }
}

/** Connect (or reconnect) the client's store with a custom-app token or client id + secret. */
export async function POST(request: NextRequest) {
  try {
    const { gc } = await growthRequest('approve');
    const input = shopifyConnectSchema.parse(await request.json());
    const store = await shopifyService.connect(gc.organizationId, gc.customerId, input);
    const row = await prisma.socialShopifyStore.findUnique({ where: { customerId: gc.customerId }, select: { id: true } });
    if (row) {
      await enqueueStoreSync(row.id).catch((err) => console.error('[growth] enqueue sync failed', err));
    }
    return Response.json(store);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE() {
  try {
    const { gc } = await growthRequest('approve');
    await shopifyService.disconnect(gc.organizationId, gc.customerId);
    return new Response(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
