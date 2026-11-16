import type { NextRequest } from 'next/server';
import {
  agencyWhatsAppService,
  saveAgencyNotifySchema,
  saveClientNotifySchema,
} from '@/modules/social/server/whatsapp/agency-whatsapp.service';
import { getClientScope } from '@/shared/server/client-scope';
import { errorResponse } from '@/shared/server/http-error';

export async function GET() {
  try {
    const scope = await getClientScope('inbox');
    const [agency, clients] = await Promise.all([
      agencyWhatsAppService.getAgencyNotify(scope.organizationId),
      agencyWhatsAppService.listClientNotify(scope.organizationId),
    ]);
    return Response.json({ agency, clients });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const scope = await getClientScope('inbox');
    const json = await request.json();
    if (json?.customerId) {
      const body = saveClientNotifySchema.parse(json);
      return Response.json(await agencyWhatsAppService.saveClientNotify(scope.organizationId, body));
    }
    const body = saveAgencyNotifySchema.parse(json);
    return Response.json(await agencyWhatsAppService.saveAgencyNotify(scope.organizationId, body));
  } catch (error) {
    return errorResponse(error);
  }
}
