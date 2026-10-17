import type { NextRequest } from 'next/server';
import { saveAutopostSchema } from '@/modules/social/server/autoposts/autopost.schema';
import { autopostService } from '@/modules/social/server/autoposts/autopost.service';
import { getClientScope } from '@/shared/server/client-scope';
import { errorResponse } from '@/shared/server/http-error';

export async function PUT(request: NextRequest, ctx: RouteContext<'/api/social/autoposts/[id]'>) {
  try {
    const { id } = await ctx.params;
    const scope = await getClientScope('publish');
    const body = saveAutopostSchema.parse(await request.json());
    return Response.json(await autopostService.update(scope, id, body));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  ctx: RouteContext<'/api/social/autoposts/[id]'>
) {
  try {
    const { id } = await ctx.params;
    const scope = await getClientScope('publish');
    await autopostService.remove(scope, id);
    return new Response(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
