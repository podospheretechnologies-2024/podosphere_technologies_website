import type { NextRequest } from 'next/server';
import { errorResponse, HttpError } from '@/shared/server/http-error';
import { growthRequest } from '@/modules/social/server/growth/growth-http';
import { ga4AssignSchema } from '@/modules/social/server/growth/growth.schema';
import { ga4Service } from '@/modules/social/server/growth/ga4.service';
import { enqueueGa4Sync } from '@/modules/social/server/growth/growth.queue';

/** Google Analytics status for the selected client (no tokens). */
export async function GET() {
  try {
    const { gc, canReview, isAdmin } = await growthRequest('view');
    return Response.json(await ga4Service.getStatus(gc.organizationId, gc.customerId, { canReview, canConnect: isAdmin }));
  } catch (error) {
    return errorResponse(error);
  }
}

/** Assign (or clear) the client's GA4 property, then queue the first sync. */
export async function PUT(request: NextRequest) {
  try {
    const { gc, canReview, isAdmin } = await growthRequest('approve');
    const { propertyId } = ga4AssignSchema.parse(await request.json());
    const rowId = await ga4Service.assign(gc.organizationId, gc.customerId, propertyId);
    if (rowId) await enqueueGa4Sync(rowId).catch((err) => console.error('[growth] enqueue GA4 sync failed', err));
    return Response.json(await ga4Service.getStatus(gc.organizationId, gc.customerId, { canReview, canConnect: isAdmin }));
  } catch (error) {
    return errorResponse(error);
  }
}

/** Owner / admin: remove the organization's Google Analytics login (synced numbers stay). */
export async function DELETE() {
  try {
    const { gc, isAdmin } = await growthRequest('approve');
    if (!isAdmin) throw new HttpError(403, 'Only an owner or admin can disconnect Google Analytics.');
    await ga4Service.disconnect(gc.organizationId);
    return new Response(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
