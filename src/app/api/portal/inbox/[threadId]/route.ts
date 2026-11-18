import { portalInboxService } from '@/modules/social/server/portal/portal-inbox.service';
import { requirePortalTab } from '@/modules/social/server/portal/portal-guard';
import { errorResponse } from '@/shared/server/http-error';

type Params = { params: Promise<{ threadId: string }> };

/** Client portal Inbox — thread detail + messages. */
export async function GET(_request: Request, { params }: Params) {
  try {
    const session = await requirePortalTab('inbox', 'view');
    const { threadId } = await params;
    const data = await portalInboxService.getThread(session, threadId);
    return Response.json(data);
  } catch (error) {
    return errorResponse(error);
  }
}
