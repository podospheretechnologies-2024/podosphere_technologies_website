import type { NextRequest } from 'next/server';
import { orderFlowService } from '@/modules/social/server/whatsapp/order-flow.service';
import { getClientScope } from '@/shared/server/client-scope';
import { errorResponse, HttpError } from '@/shared/server/http-error';
import { z } from 'zod';

const pauseSchema = z.object({
  action: z.enum(['pause', 'resume']),
  reason: z.string().trim().max(255).optional(),
});

export async function GET() {
  try {
    const scope = await getClientScope('inbox');
    return Response.json(await orderFlowService.listFlows(scope));
  } catch (error) {
    return errorResponse(error);
  }
}

/** PATCH: pause or resume all order flows for the selected client's store. */
export async function PATCH(request: NextRequest) {
  try {
    const scope = await getClientScope('inbox');
    const body = pauseSchema.parse(await request.json());
    if (body.action === 'pause') {
      return Response.json(await orderFlowService.pauseFlows(scope, body.reason));
    }
    if (body.action === 'resume') {
      return Response.json(await orderFlowService.resumeFlows(scope));
    }
    throw new HttpError(400, 'Unknown action');
  } catch (error) {
    return errorResponse(error);
  }
}
