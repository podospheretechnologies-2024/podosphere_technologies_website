import { whatsappService } from '@/modules/social/server/whatsapp/whatsapp.service';
import { getCurrentOrganization } from '@/shared/server/current-organization';
import { errorResponse } from '@/shared/server/http-error';

// The business number's status and its message templates.
export async function GET() {
  try {
    await getCurrentOrganization();
    if (!whatsappService.isConfigured()) {
      return Response.json({
        configured: false,
        number: null,
        templates: [],
        templatesAvailable: false,
      });
    }
    return Response.json(await whatsappService.overview());
  } catch (error) {
    return errorResponse(error);
  }
}
