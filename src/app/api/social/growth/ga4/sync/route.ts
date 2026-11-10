import { errorResponse, HttpError } from '@/shared/server/http-error';
import { growthRequest } from '@/modules/social/server/growth/growth-http';
import { ga4Service } from '@/modules/social/server/growth/ga4.service';

/** Sync now (runs in the request so the user sees the result; the worker also syncs every 3 hours). */
export async function POST() {
  try {
    const { gc, canReview, isAdmin } = await growthRequest('draft');
    const row = await ga4Service.propertyRowFor(gc.organizationId, gc.customerId);
    if (!row) throw new HttpError(400, 'Pick the GA4 property for this client first.');
    await ga4Service.syncProperty(row.id);
    return Response.json(await ga4Service.getStatus(gc.organizationId, gc.customerId, { canReview, canConnect: isAdmin }));
  } catch (error) {
    return errorResponse(error);
  }
}
