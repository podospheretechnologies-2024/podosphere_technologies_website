import type { NextRequest } from 'next/server';
import { planService } from '@/modules/social/server/billing/plan.service';
import {
  leadWhatsAppService,
  sendLeadTemplateSchema,
} from '@/modules/social/server/whatsapp/lead-whatsapp.service';
import { getClientScope } from '@/shared/server/client-scope';
import { errorResponse } from '@/shared/server/http-error';

/** Send one approved template to the selected leads. */
export async function POST(request: NextRequest) {
  try {
    const scope = await getClientScope('leads');
    await planService.assertFeature(scope.organizationId, 'leads');
    const body = sendLeadTemplateSchema.parse(await request.json());
    return Response.json(await leadWhatsAppService.sendTemplate(scope, body));
  } catch (error) {
    return errorResponse(error);
  }
}
