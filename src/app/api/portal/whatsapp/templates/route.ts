import { portalWhatsAppService } from '@/modules/social/server/portal/portal-whatsapp.service';
import { requirePortalTab } from '@/modules/social/server/portal/portal-guard';
import { errorResponse } from '@/shared/server/http-error';

/** Client portal WhatsApp — list APPROVED templates for the linked number. */
export async function GET() {
  try {
    const session = await requirePortalTab('whatsapp', 'view');
    const data = await portalWhatsAppService.listTemplates(session);
    return Response.json(data);
  } catch (error) {
    return errorResponse(error);
  }
}
