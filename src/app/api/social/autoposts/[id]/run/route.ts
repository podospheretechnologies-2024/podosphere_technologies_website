import type { NextRequest } from 'next/server';
import { autopostService } from '@/modules/social/server/autoposts/autopost.service';
import { getClientScope } from '@/shared/server/client-scope';
import { errorResponse } from '@/shared/server/http-error';

export async function POST(
  _request: NextRequest,
  ctx: RouteContext<'/api/social/autoposts/[id]/run'>
) {
  try {
    const { id } = await ctx.params;
    const scope = await getClientScope('publish');
    return Response.json(await autopostService.run(scope, id));
  } catch (error) {
    return errorResponse(error);
  }
}
