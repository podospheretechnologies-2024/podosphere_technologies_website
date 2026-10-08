import type { NextRequest } from 'next/server';
import { getCurrentUser } from '@/modules/auth/server/session';
import { sendWhatsAppSchema } from '@/modules/social/server/whatsapp/whatsapp.schema';
import { whatsappService } from '@/modules/social/server/whatsapp/whatsapp.service';
import { getCurrentOrganization } from '@/shared/server/current-organization';
import { requireRole } from '@/shared/server/access';
import { errorResponse } from '@/shared/server/http-error';

// Sends one text or template message from the business number.
export async function POST(request: NextRequest) {
  try {
    const org = await getCurrentOrganization();
    await requireRole('ADMIN');
    const user = await getCurrentUser();
    const input = sendWhatsAppSchema.parse(await request.json());
    return Response.json(
      await whatsappService.send(org.id, input, {
        senderName: user?.name ?? user?.email ?? null,
      }),
      { status: 201 }
    );
  } catch (error) {
    return errorResponse(error);
  }
}
