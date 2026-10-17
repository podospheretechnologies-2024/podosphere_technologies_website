import type { NextRequest } from 'next/server';
import { saveTagSchema } from '@/modules/social/server/tags/tag.schema';
import { tagService } from '@/modules/social/server/tags/tag.service';
import { getClientScope } from '@/shared/server/client-scope';
import { errorResponse } from '@/shared/server/http-error';

export async function PUT(request: NextRequest, ctx: RouteContext<'/api/social/tags/[id]'>) {
  try {
    const { id } = await ctx.params;
    const scope = await getClientScope('draft');
    const body = saveTagSchema.parse(await request.json());
    return Response.json(await tagService.update(scope, id, body));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: NextRequest, ctx: RouteContext<'/api/social/tags/[id]'>) {
  try {
    const { id } = await ctx.params;
    const scope = await getClientScope('draft');
    await tagService.remove(scope, id);
    return new Response(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
