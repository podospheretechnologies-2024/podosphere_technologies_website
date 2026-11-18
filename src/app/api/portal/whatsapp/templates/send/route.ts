import type { NextRequest } from 'next/server';
import { portalWhatsAppSendTemplateSchema } from '@/modules/social/server/portal/portal-whatsapp.schema';
import { portalWhatsAppService } from '@/modules/social/server/portal/portal-whatsapp.service';
import { requirePortalTab } from '@/modules/social/server/portal/portal-guard';
import { errorResponse } from '@/shared/server/http-error';

/** Client portal WhatsApp — send one approved template (requires "Can act"). */
export async function POST(request: NextRequest) {
  try {
    const session = await requirePortalTab('whatsapp', 'act');
    const body = portalWhatsAppSendTemplateSchema.parse(await request.json());
    const data = await portalWhatsAppService.sendTemplate(session, body);
    return Response.json(data, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
