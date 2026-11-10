import { errorResponse } from '@/shared/server/http-error';
import { growthRequest } from '@/modules/social/server/growth/growth-http';
import { shopifyService } from '@/modules/social/server/growth/shopify.service';
import { ga4Service } from '@/modules/social/server/growth/ga4.service';
import { prisma } from '@/shared/lib/prisma';

export async function GET() {
  try {
    const { gc } = await growthRequest('view');
    const [store, ga4, snapshot] = await Promise.all([
      shopifyService.get(gc.organizationId, gc.customerId),
      ga4Service.website(gc.organizationId, gc.customerId),
      prisma.shopifyTrafficSnapshot.findFirst({
        where: { organizationId: gc.organizationId, customerId: gc.customerId },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return Response.json({
      store,
      ga4,
      snapshot: snapshot
        ? {
            periodStart: snapshot.periodStart.toISOString().slice(0, 10),
            periodEnd: snapshot.periodEnd.toISOString().slice(0, 10),
            sessions: snapshot.sessions,
            addToCart: snapshot.addToCart,
            orders: snapshot.orders,
            landing: snapshot.landing,
            sources: snapshot.sources,
            devices: snapshot.devices,
            note: snapshot.note,
          }
        : null,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
