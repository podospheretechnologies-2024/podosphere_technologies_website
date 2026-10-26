import type { NextRequest } from 'next/server';
import { saveHashtagGroupSchema } from '@/modules/social/server/hashtag-groups/hashtag-group.schema';
import { hashtagGroupService } from '@/modules/social/server/hashtag-groups/hashtag-group.service';
import { getClientScope } from '@/shared/server/client-scope';
import { errorResponse } from '@/shared/server/http-error';

export async function PUT(request: NextRequest, ctx: RouteContext<'/api/social/hashtag-groups/[id]'>) {
  try {
    const { id } = await ctx.params;
    const scope = await getClientScope('draft');
    const body = saveHashtagGroupSchema.parse(await request.json());
    return Response.json(await hashtagGroupService.update(scope, id, body));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  ctx: RouteContext<'/api/social/hashtag-groups/[id]'>
) {
  try {
    const { id } = await ctx.params;
    const scope = await getClientScope('draft');
    await hashtagGroupService.remove(scope, id);
    return new Response(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
