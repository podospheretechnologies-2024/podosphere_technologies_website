import type { NextRequest } from 'next/server';
import { portalAgentCreateThreadSchema } from '@/modules/social/server/portal/portal-agent.schema';
import { portalAgentService } from '@/modules/social/server/portal/portal-agent.service';
import { requirePortalTab } from '@/modules/social/server/portal/portal-guard';
import { errorResponse, methodNotAllowed } from '@/shared/server/http-error';

/** Client portal: list AI threads for this client only. */
export async function GET() {
  try {
    const session = await requirePortalTab('agent', 'view');
    const threads = await portalAgentService.listThreads(session);
    return Response.json({ threads });
  } catch (error) {
    return errorResponse(error);
  }
}

/** Client portal: start a new chat thread (scoped to session client). */
export async function POST(request: NextRequest) {
  try {
    const session = await requirePortalTab('agent', 'act');
    const body = portalAgentCreateThreadSchema.parse(await request.json().catch(() => ({})));
    const thread = await portalAgentService.createThread(session, body);
    return Response.json({ thread }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export function PUT() {
  return methodNotAllowed('GET, POST');
}
