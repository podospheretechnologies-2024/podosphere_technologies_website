import type { NextRequest } from 'next/server';
import { agentService } from '@/modules/social/server/ai/agent/agent.service';
import { getClientScope } from '@/shared/server/client-scope';
import { errorResponse, methodNotAllowed } from '@/shared/server/http-error';

type Params = { params: Promise<{ id: string }> };

export function POST() {
  return methodNotAllowed('GET');
}

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const scope = await getClientScope('view');
    const { id } = await params;
    return Response.json(await agentService.getThread(scope, id));
  } catch (error) {
    return errorResponse(error);
  }
}
