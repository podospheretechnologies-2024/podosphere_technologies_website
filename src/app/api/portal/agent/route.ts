import { portalAgentService } from '@/modules/social/server/portal/portal-agent.service';
import { requirePortalTab } from '@/modules/social/server/portal/portal-guard';
import { errorResponse, methodNotAllowed } from '@/shared/server/http-error';

/** Client portal: AI status + recent threads for this client only. */
export async function GET() {
  try {
    const session = await requirePortalTab('agent', 'view');
    const [status, threads] = await Promise.all([
      portalAgentService.status(session),
      portalAgentService.listThreads(session),
    ]);
    return Response.json({ ...status, threads });
  } catch (error) {
    return errorResponse(error);
  }
}

export function POST() {
  return methodNotAllowed('GET');
}
