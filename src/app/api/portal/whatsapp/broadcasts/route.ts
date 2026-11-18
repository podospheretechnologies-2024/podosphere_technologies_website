import type { NextRequest } from 'next/server';
import { portalWhatsAppBroadcastSchema } from '@/modules/social/server/portal/portal-whatsapp.schema';
import { portalWhatsAppService } from '@/modules/social/server/portal/portal-whatsapp.service';
import { requirePortalTab } from '@/modules/social/server/portal/portal-guard';
import { errorResponse } from '@/shared/server/http-error';

/** List this client's WhatsApp broadcasts. */
export async function GET() {
  try {
    const session = await requirePortalTab('whatsapp', 'view');
    return Response.json(await portalWhatsAppService.listBroadcasts(session));
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * Prepare (pending_approval) or send a broadcast when approval is off.
 * Requires WhatsApp "Can act". Never sends when whatsappBroadcastNeedsApproval is true.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requirePortalTab('whatsapp', 'act');
    const body = portalWhatsAppBroadcastSchema.parse(await request.json());
    const data = await portalWhatsAppService.createBroadcast(session, body);
    return Response.json(data, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
