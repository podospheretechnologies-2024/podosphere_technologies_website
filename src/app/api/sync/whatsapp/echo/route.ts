import type { NextRequest } from 'next/server';
import { podoCrmWhatsAppSyncService } from '@/modules/social/server/podocrm/podocrm-whatsapp-sync.service';
import { errorResponse } from '@/shared/server/http-error';

/**
 * Partner callback for PodoCRM → PodoSocial outbound echo.
 * CRM signs with the shared sync_secret (same scheme as Social → CRM echo).
 */
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('x-podo-signature');
    const result = await podoCrmWhatsAppSyncService.ingestPartnerEcho(rawBody, signature);
    return Response.json({ ok: true, ...result });
  } catch (error) {
    return errorResponse(error);
  }
}
