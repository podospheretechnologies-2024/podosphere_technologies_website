import type { NextRequest } from 'next/server';
import { saveBioPageSchema } from '@/modules/social/server/bio-pages/bio-page.schema';
import { bioPageService } from '@/modules/social/server/bio-pages/bio-page.service';
import { getClientScope } from '@/shared/server/client-scope';
import { errorResponse } from '@/shared/server/http-error';

export async function PUT(request: NextRequest, ctx: RouteContext<'/api/social/bio-pages/[id]'>) {
  try {
    const { id } = await ctx.params;
    const scope = await getClientScope('draft');
    const body = saveBioPageSchema.parse(await request.json());
    return Response.json(await bioPageService.update(scope, id, body));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  ctx: RouteContext<'/api/social/bio-pages/[id]'>
) {
  try {
    const { id } = await ctx.params;
    const scope = await getClientScope('draft');
    await bioPageService.remove(scope, id);
    return new Response(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
