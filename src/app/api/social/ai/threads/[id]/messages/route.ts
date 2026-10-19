import type { NextRequest } from 'next/server';
import { postMessageBodySchema } from '@/modules/social/server/ai/agent/agent.schema';
import { agentService } from '@/modules/social/server/ai/agent/agent.service';
import { getClientScope } from '@/shared/server/client-scope';
import { errorResponse, methodNotAllowed } from '@/shared/server/http-error';

type Params = { params: Promise<{ id: string }> };

export const maxDuration = 120;

export function GET() {
  return methodNotAllowed('POST');
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const scope = await getClientScope('draft');
    const { id } = await params;
    const body = postMessageBodySchema.parse(await request.json());
    return Response.json(await agentService.postMessage(scope, id, body.message));
  } catch (error) {
    return errorResponse(error);
  }
}
