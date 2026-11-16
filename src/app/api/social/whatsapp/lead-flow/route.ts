import type { NextRequest } from 'next/server';
import {
  leadWhatsAppService,
  saveLeadFlowSchema,
} from '@/modules/social/server/whatsapp/lead-whatsapp.service';
import { getClientScope } from '@/shared/server/client-scope';
import { errorResponse } from '@/shared/server/http-error';

export async function GET() {
  try {
    const scope = await getClientScope('inbox');
    return Response.json(await leadWhatsAppService.getFlow(scope));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const scope = await getClientScope('inbox');
    const body = saveLeadFlowSchema.parse(await request.json());
    return Response.json(await leadWhatsAppService.saveFlow(scope, body));
  } catch (error) {
    return errorResponse(error);
  }
}
