import { whatsappService } from '@/modules/social/server/whatsapp/whatsapp.service';
import { getClientScope } from '@/shared/server/client-scope';
import { errorResponse } from '@/shared/server/http-error';

export async function GET() {
  try {
    const scope = await getClientScope('inbox');
    if (!whatsappService.isConfigured()) {
      return Response.json([]);
    }
    return Response.json(await whatsappService.listConversations(scope));
  } catch (error) {
    return errorResponse(error);
  }
}
