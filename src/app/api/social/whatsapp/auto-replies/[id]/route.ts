import type { NextRequest } from 'next/server';
import { saveWhatsAppAutoReplySchema } from '@/modules/social/server/whatsapp/auto-reply.schema';
import { autoReplyService } from '@/modules/social/server/whatsapp/auto-reply.service';
import { getClientScope } from '@/shared/server/client-scope';
import { errorResponse } from '@/shared/server/http-error';

export async function PUT(
  request: NextRequest,
  ctx: RouteContext<'/api/social/whatsapp/auto-replies/[id]'>
) {
  try {
    const { id } = await ctx.params;
    const scope = await getClientScope('inbox');
    const body = saveWhatsAppAutoReplySchema.parse(await request.json());
    return Response.json(await autoReplyService.update(scope, id, body));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  ctx: RouteContext<'/api/social/whatsapp/auto-replies/[id]'>
) {
  try {
    const { id } = await ctx.params;
    const scope = await getClientScope('inbox');
    await autoReplyService.remove(scope, id);
    return new Response(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
