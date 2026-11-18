import type { NextRequest } from 'next/server';
import { listOrderFlowResultsSchema } from '@/modules/social/server/whatsapp/order-flow.schema';
import { orderFlowService } from '@/modules/social/server/whatsapp/order-flow.service';
import { getClientScope } from '@/shared/server/client-scope';
import { errorResponse } from '@/shared/server/http-error';

export async function GET(request: NextRequest) {
  try {
    const scope = await getClientScope('inbox');
    const sp = request.nextUrl.searchParams;
    const filters = listOrderFlowResultsSchema.parse({
      from: sp.get('from') ?? undefined,
      to: sp.get('to') ?? undefined,
    });
    return Response.json(await orderFlowService.results(scope, filters));
  } catch (error) {
    return errorResponse(error);
  }
}
