import { agencyWhatsAppService } from '@/modules/social/server/whatsapp/agency-whatsapp.service';
import { getClientScope } from '@/shared/server/client-scope';
import { errorResponse } from '@/shared/server/http-error';

export async function GET() {
  try {
    const scope = await getClientScope('inbox');
    return Response.json(await agencyWhatsAppService.adChatSummary(scope));
  } catch (error) {
    return errorResponse(error);
  }
}
