import { portalLeadsService } from '@/modules/social/server/portal/portal-leads.service';
import { requirePortalSessionReady } from '@/shared/server/portal-session';
import { errorResponse } from '@/shared/server/http-error';

/** Client portal Leads — customerId/org only from session. */
export async function GET() {
  try {
    const session = await requirePortalSessionReady();
    const data = await portalLeadsService.list(session);
    return Response.json(data);
  } catch (error) {
    return errorResponse(error);
  }
}
