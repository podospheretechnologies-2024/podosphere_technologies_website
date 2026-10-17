import type { NextRequest } from 'next/server';
import { renameSetSchema } from '@/modules/social/server/sets/set.schema';
import { setService } from '@/modules/social/server/sets/set.service';
import { getClientScope } from '@/shared/server/client-scope';
import { errorResponse } from '@/shared/server/http-error';

export async function PUT(request: NextRequest, ctx: RouteContext<'/api/social/sets/[id]'>) {
  try {
    const { id } = await ctx.params;
    const scope = await getClientScope('draft');
    const body = renameSetSchema.parse(await request.json());
    return Response.json(await setService.rename(scope, id, body));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: NextRequest, ctx: RouteContext<'/api/social/sets/[id]'>) {
  try {
    const { id } = await ctx.params;
    const scope = await getClientScope('draft');
    await setService.remove(scope, id);
    return new Response(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
