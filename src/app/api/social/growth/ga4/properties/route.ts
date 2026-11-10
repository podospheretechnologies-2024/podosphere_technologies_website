import { errorResponse } from '@/shared/server/http-error';
import { growthRequest } from '@/modules/social/server/growth/growth-http';
import { ga4Service } from '@/modules/social/server/growth/ga4.service';

/** Re-list the GA4 properties the connected Google login can read (after access was added). */
export async function POST() {
  try {
    const { gc, canReview, isAdmin } = await growthRequest('approve');
    await ga4Service.refreshProperties(gc.organizationId);
    return Response.json(await ga4Service.getStatus(gc.organizationId, gc.customerId, { canReview, canConnect: isAdmin }));
  } catch (error) {
    return errorResponse(error);
  }
}
