import type { NextRequest } from 'next/server';
import { createThreadBodySchema } from '@/modules/social/server/ai/agent/agent.schema';
import { agentService } from '@/modules/social/server/ai/agent/agent.service';
import { getAccess } from '@/shared/server/access';
import { getClientScope } from '@/shared/server/client-scope';
import { errorResponse, methodNotAllowed } from '@/shared/server/http-error';

export function GET() {
  return methodNotAllowed('POST');
}

export async function POST(request: NextRequest) {
  try {
    const scope = await getClientScope('draft');
    const access = await getAccess();
    const body = createThreadBodySchema.parse(await request.json().catch(() => ({})));
    const thread = await agentService.createThread(scope, {
      title: body.title,
      userId: access.user.id,
    });
    return Response.json(thread, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
