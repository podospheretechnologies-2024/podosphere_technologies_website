import type { NextRequest } from 'next/server';
import { portalWhatsAppReplySchema } from '@/modules/social/server/portal/portal-whatsapp.schema';
import { portalWhatsAppService } from '@/modules/social/server/portal/portal-whatsapp.service';
import { requirePortalTab } from '@/modules/social/server/portal/portal-guard';
import { errorResponse } from '@/shared/server/http-error';

type Params = { params: Promise<{ id: string }> };

/** Client portal WhatsApp reply — requires whatsapp "Can act". */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const session = await requirePortalTab('whatsapp', 'act');
    const { id } = await params;
    const body = portalWhatsAppReplySchema.parse(await request.json());
    const data = await portalWhatsAppService.reply(session, id, body.text);
    return Response.json(data, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
