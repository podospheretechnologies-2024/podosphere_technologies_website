import type { NextRequest } from 'next/server';
import { whatsappService } from '@/modules/social/server/whatsapp/whatsapp.service';
import { getCurrentOrganization } from '@/shared/server/current-organization';
import { errorResponse } from '@/shared/server/http-error';

export async function GET(
  _request: NextRequest,
  ctx: RouteContext<'/api/social/whatsapp/conversations/[id]'>
) {
  try {
    const org = await getCurrentOrganization();
    const { id } = await ctx.params;
    return Response.json(await whatsappService.getConversation(org.id, id));
  } catch (error) {
    return errorResponse(error);
  }
}
