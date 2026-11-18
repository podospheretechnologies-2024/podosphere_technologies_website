import type { NextRequest } from 'next/server';
import { listOrderFlowActivitySchema } from '@/modules/social/server/whatsapp/order-flow.schema';
import { orderFlowService } from '@/modules/social/server/whatsapp/order-flow.service';
import { getClientScope } from '@/shared/server/client-scope';
import { errorResponse } from '@/shared/server/http-error';

export async function GET(request: NextRequest) {
  try {
    const scope = await getClientScope('inbox');
    const sp = request.nextUrl.searchParams;
    const filters = listOrderFlowActivitySchema.parse({
      flowKey: sp.get('flowKey') ?? undefined,
      status: sp.get('status') ?? undefined,
      from: sp.get('from') ?? undefined,
      to: sp.get('to') ?? undefined,
      limit: sp.get('limit') ?? undefined,
      offset: sp.get('offset') ?? undefined,
    });
    return Response.json(await orderFlowService.activity(scope, filters));
  } catch (error) {
    return errorResponse(error);
  }
}
