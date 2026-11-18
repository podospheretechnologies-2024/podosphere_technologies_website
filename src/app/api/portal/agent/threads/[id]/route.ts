import type { NextRequest } from 'next/server';
import { portalAgentService } from '@/modules/social/server/portal/portal-agent.service';
import { requirePortalTab } from '@/modules/social/server/portal/portal-guard';
import { errorResponse, methodNotAllowed } from '@/shared/server/http-error';

type Params = { params: Promise<{ id: string }> };

/** Client portal: load one AI thread belonging to this client. */
export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const session = await requirePortalTab('agent', 'view');
    const { id } = await params;
    const thread = await portalAgentService.getThread(session, id);
    return Response.json({ thread });
  } catch (error) {
    return errorResponse(error);
  }
}

export function POST() {
  return methodNotAllowed('GET');
}
