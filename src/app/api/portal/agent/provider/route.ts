import type { NextRequest } from 'next/server';
import { portalAgentProviderSchema } from '@/modules/social/server/portal/portal-agent.schema';
import { portalAgentService } from '@/modules/social/server/portal/portal-agent.service';
import { requirePortalTab } from '@/modules/social/server/portal/portal-guard';
import { errorResponse, methodNotAllowed } from '@/shared/server/http-error';

/** Client portal: this client's own AI provider status (no agency / .env keys). */
export async function GET() {
  try {
    const session = await requirePortalTab('agent', 'view');
    return Response.json(await portalAgentService.getProvider(session));
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * Client portal: save this client's own AI API key (mandatory for every client).
 * Allowed at View or Can act — key setup is account setup, not a chat action.
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await requirePortalTab('agent', 'view');
    const body = portalAgentProviderSchema.parse(await request.json());
    return Response.json(await portalAgentService.saveProvider(session, body));
  } catch (error) {
    return errorResponse(error);
  }
}

export function POST() {
  return methodNotAllowed('GET, PUT');
}
