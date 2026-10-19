import type { NextRequest } from 'next/server';
import { saveSavedReplySchema } from '@/modules/social/server/saved-replies/saved-reply.schema';
import { savedReplyService } from '@/modules/social/server/saved-replies/saved-reply.service';
import { getClientScope } from '@/shared/server/client-scope';
import { errorResponse } from '@/shared/server/http-error';

type Context = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, ctx: Context) {
  try {
    const scope = await getClientScope('inbox');
    const { id } = await ctx.params;
    const body = saveSavedReplySchema.parse(await request.json());
    return Response.json(await savedReplyService.update(scope, id, body));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: NextRequest, ctx: Context) {
  try {
    const scope = await getClientScope('inbox');
    const { id } = await ctx.params;
    await savedReplyService.remove(scope, id);
    return new Response(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
