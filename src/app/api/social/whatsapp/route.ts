import { whatsappService } from '@/modules/social/server/whatsapp/whatsapp.service';
import { getClientScope } from '@/shared/server/client-scope';
import { errorResponse } from '@/shared/server/http-error';

// The business number's status and its message templates.
export async function GET() {
  try {
    const scope = await getClientScope('inbox');
    if (!(await whatsappService.isConfiguredForScope(scope))) {
      return Response.json({
        configured: false,
        number: null,
        templates: [],
        templatesAvailable: false,
      });
    }
    return Response.json(await whatsappService.overview(scope));
  } catch (error) {
    return errorResponse(error);
  }
}
