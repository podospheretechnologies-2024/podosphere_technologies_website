import { whatsappService } from '@/modules/social/server/whatsapp/whatsapp.service';
import { getCurrentOrganization } from '@/shared/server/current-organization';
import { errorResponse } from '@/shared/server/http-error';

export async function GET() {
  try {
    const org = await getCurrentOrganization();
    if (!whatsappService.isConfigured()) {
      return Response.json([]);
    }
    return Response.json(await whatsappService.listConversations(org.id));
  } catch (error) {
    return errorResponse(error);
  }
}
