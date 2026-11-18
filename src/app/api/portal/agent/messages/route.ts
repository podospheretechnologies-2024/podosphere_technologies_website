import type { NextRequest } from 'next/server';
import { portalAgentMessageSchema } from '@/modules/social/server/portal/portal-agent.schema';
import { portalAgentService } from '@/modules/social/server/portal/portal-agent.service';
import { requirePortalTab } from '@/modules/social/server/portal/portal-guard';
import { errorResponse, methodNotAllowed } from '@/shared/server/http-error';

export const maxDuration = 120;

/** Client portal: send a chat message (creates a thread when threadId is omitted). */
export async function POST(request: NextRequest) {
  try {
    const session = await requirePortalTab('agent', 'act');
    const body = portalAgentMessageSchema.parse(await request.json());
    const thread = await portalAgentService.sendMessage(session, body);
    return Response.json({ thread });
  } catch (error) {
    return errorResponse(error);
  }
}

export function GET() {
  return methodNotAllowed('POST');
}
