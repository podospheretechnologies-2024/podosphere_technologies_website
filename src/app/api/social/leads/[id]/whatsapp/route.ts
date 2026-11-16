import { leadWhatsAppService } from '@/modules/social/server/whatsapp/lead-whatsapp.service';
import { getClientScope } from '@/shared/server/client-scope';
import { errorResponse } from '@/shared/server/http-error';

type Context = { params: Promise<{ id: string }> };

/** The WhatsApp chat with this lead. */
export async function GET(_request: Request, ctx: Context) {
  try {
    const scope = await getClientScope('leads');
    const { id } = await ctx.params;
    return Response.json(await leadWhatsAppService.chat(scope, id));
  } catch (error) {
    return errorResponse(error);
  }
}
