import type { NextRequest } from 'next/server';
import { whatsappService } from '@/modules/social/server/whatsapp/whatsapp.service';
import { getClientScope } from '@/shared/server/client-scope';
import { errorResponse } from '@/shared/server/http-error';

export async function GET(
  _request: NextRequest,
  ctx: RouteContext<'/api/social/whatsapp/conversations/[id]'>
) {
  try {
    const scope = await getClientScope('inbox');
    const { id } = await ctx.params;
    return Response.json(await whatsappService.getConversation(scope, id));
  } catch (error) {
    return errorResponse(error);
  }
}
