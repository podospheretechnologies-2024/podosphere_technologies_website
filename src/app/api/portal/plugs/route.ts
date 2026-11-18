import { portalPlugsService } from '@/modules/social/server/portal/portal-plugs.service';
import { requirePortalTab } from '@/modules/social/server/portal/portal-guard';
import { errorResponse } from '@/shared/server/http-error';

/** Client portal Plugs — read-only auto-replies for session org + customer. */
export async function GET() {
  try {
    const session = await requirePortalTab('plugs', 'view');
    const data = await portalPlugsService.list(session);
    return Response.json(data);
  } catch (error) {
    return errorResponse(error);
  }
}
