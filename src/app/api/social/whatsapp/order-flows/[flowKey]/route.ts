import type { NextRequest } from 'next/server';
import { patchOrderFlowSchema } from '@/modules/social/server/whatsapp/order-flow.schema';
import { orderFlowService } from '@/modules/social/server/whatsapp/order-flow.service';
import { getClientScope } from '@/shared/server/client-scope';
import { errorResponse } from '@/shared/server/http-error';

type Ctx = { params: Promise<{ flowKey: string }> };

export async function GET(_request: NextRequest, context: Ctx) {
  try {
    const scope = await getClientScope('inbox');
    const { flowKey } = await context.params;
    return Response.json(await orderFlowService.getFlow(scope, flowKey));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: NextRequest, context: Ctx) {
  try {
    const scope = await getClientScope('inbox');
    const { flowKey } = await context.params;
    const body = patchOrderFlowSchema.parse(await request.json());
    return Response.json(await orderFlowService.updateFlow(scope, flowKey, body));
  } catch (error) {
    return errorResponse(error);
  }
}
