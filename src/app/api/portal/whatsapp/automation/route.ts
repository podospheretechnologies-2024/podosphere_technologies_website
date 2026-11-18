import { portalWhatsAppService } from '@/modules/social/server/portal/portal-whatsapp.service';
import { requirePortalTab } from '@/modules/social/server/portal/portal-guard';
import { errorResponse } from '@/shared/server/http-error';

/** Auto-replies + lead-flow status for the client's WhatsApp number (view). */
export async function GET() {
  try {
    const session = await requirePortalTab('whatsapp', 'view');
    return Response.json(await portalWhatsAppService.automation(session));
  } catch (error) {
    return errorResponse(error);
  }
}
