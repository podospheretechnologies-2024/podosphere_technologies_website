import type { NextRequest } from 'next/server';
import { testOrderFlowSendSchema } from '@/modules/social/server/whatsapp/order-flow.schema';
import { orderFlowService } from '@/modules/social/server/whatsapp/order-flow.service';
import { getClientScope } from '@/shared/server/client-scope';
import { errorResponse } from '@/shared/server/http-error';

type Ctx = { params: Promise<{ flowKey: string }> };

export async function POST(request: NextRequest, context: Ctx) {
  try {
    const scope = await getClientScope('inbox');
    const { flowKey } = await context.params;
    const body = testOrderFlowSendSchema.parse(await request.json());
    return Response.json(await orderFlowService.sendTest(scope, flowKey, body));
  } catch (error) {
    return errorResponse(error);
  }
}
