import { portalInboxService } from '@/modules/social/server/portal/portal-inbox.service';
import { requirePortalTab } from '@/modules/social/server/portal/portal-guard';
import { errorResponse } from '@/shared/server/http-error';

/** Client portal Inbox — list threads for session org + customer only. */
export async function GET() {
  try {
    const session = await requirePortalTab('inbox', 'view');
    const data = await portalInboxService.list(session);
    return Response.json(data);
  } catch (error) {
    return errorResponse(error);
  }
}
