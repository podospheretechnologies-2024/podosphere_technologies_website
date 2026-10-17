import type { NextRequest } from 'next/server';
import { mediaService } from '@/modules/social/server/media/media.service';
import { getClientScope } from '@/shared/server/client-scope';
import { errorResponse } from '@/shared/server/http-error';

export async function DELETE(_request: NextRequest, ctx: RouteContext<'/api/social/media/[id]'>) {
  try {
    const { id } = await ctx.params;
    const scope = await getClientScope('draft');
    await mediaService.remove(scope, id);
    return new Response(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
