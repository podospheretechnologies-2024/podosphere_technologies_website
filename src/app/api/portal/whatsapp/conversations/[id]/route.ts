import type { NextRequest } from 'next/server';
import { portalWhatsAppService } from '@/modules/social/server/portal/portal-whatsapp.service';
import { requirePortalTab } from '@/modules/social/server/portal/portal-guard';
import { errorResponse } from '@/shared/server/http-error';

type Params = { params: Promise<{ id: string }> };

/** Client portal WhatsApp — open one conversation (session client only). */
export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const session = await requirePortalTab('whatsapp', 'view');
    const { id } = await params;
    const data = await portalWhatsAppService.getConversation(session, id);
    return Response.json(data);
  } catch (error) {
    return errorResponse(error);
  }
}
