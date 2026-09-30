import type { NextRequest } from 'next/server';
import { sendWhatsAppSchema } from '@/modules/social/server/whatsapp/whatsapp.schema';
import { whatsappService } from '@/modules/social/server/whatsapp/whatsapp.service';
import { getCurrentOrganization } from '@/shared/server/current-organization';
import { errorResponse } from '@/shared/server/http-error';

// Sends one text or template message from the business number.
export async function POST(request: NextRequest) {
  try {
    await getCurrentOrganization();
    const input = sendWhatsAppSchema.parse(await request.json());
    return Response.json(await whatsappService.send(input), { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
