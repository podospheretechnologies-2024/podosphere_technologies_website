import type { NextRequest } from 'next/server';
import { portalWhatsAppSummaryQuerySchema } from '@/modules/social/server/portal/portal-whatsapp.schema';
import { portalWhatsAppService } from '@/modules/social/server/portal/portal-whatsapp.service';
import { requirePortalTab } from '@/modules/social/server/portal/portal-guard';
import { errorResponse } from '@/shared/server/http-error';

/** Client portal WhatsApp overview — session org + customer only. */
export async function GET(request: NextRequest) {
  try {
    const session = await requirePortalTab('whatsapp', 'view');
    const days = portalWhatsAppSummaryQuerySchema.parse({
      days: request.nextUrl.searchParams.get('days') ?? undefined,
    }).days;
    const data = await portalWhatsAppService.summary(session, { days });
    return Response.json(data);
  } catch (error) {
    return errorResponse(error);
  }
}
