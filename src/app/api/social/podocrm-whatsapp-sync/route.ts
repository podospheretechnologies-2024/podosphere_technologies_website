import type { NextRequest } from 'next/server';
import { podoCrmWhatsAppLinkSchema } from '@/modules/social/server/podocrm/podocrm-whatsapp-sync.schema';
import { podoCrmWhatsAppSyncService } from '@/modules/social/server/podocrm/podocrm-whatsapp-sync.service';
import { getCurrentOrganization } from '@/shared/server/current-organization';
import { errorResponse } from '@/shared/server/http-error';

export async function GET() {
  try {
    const organization = await getCurrentOrganization();
    return Response.json(await podoCrmWhatsAppSyncService.getStatus(organization.id));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const organization = await getCurrentOrganization();
    const body = podoCrmWhatsAppLinkSchema.parse(await request.json());
    return Response.json(await podoCrmWhatsAppSyncService.link(organization.id, body.code));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE() {
  try {
    const organization = await getCurrentOrganization();
    await podoCrmWhatsAppSyncService.unlink(organization.id);
    return new Response(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
