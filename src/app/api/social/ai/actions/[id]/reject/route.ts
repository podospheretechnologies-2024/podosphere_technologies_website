import type { NextRequest } from 'next/server';
import { agentService } from '@/modules/social/server/ai/agent/agent.service';
import { getAccess } from '@/shared/server/access';
import { getClientScope } from '@/shared/server/client-scope';
import { errorResponse, methodNotAllowed } from '@/shared/server/http-error';

type Params = { params: Promise<{ id: string }> };

export function GET() {
  return methodNotAllowed('POST');
}

export async function POST(_request: NextRequest, { params }: Params) {
  try {
    const scope = await getClientScope('draft');
    const access = await getAccess();
    const { id } = await params;
    return Response.json(await agentService.rejectAction(scope, id, access.user.id));
  } catch (error) {
    return errorResponse(error);
  }
}
