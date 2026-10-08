import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { whatsappOnboardingService } from '@/modules/social/server/whatsapp/whatsapp-growth.service';
import { getCurrentOrganization } from '@/shared/server/current-organization';
import { requireRole } from '@/shared/server/access';
import { errorResponse } from '@/shared/server/http-error';

export async function GET() {
  try {
    const organization = await getCurrentOrganization();
    await requireRole('ADMIN');
    return Response.json({
      ...whatsappOnboardingService.config(),
      connection: await whatsappOnboardingService.connection(organization.id),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

const completeSchema = z.object({
  code: z.string().min(1),
  wabaId: z.string().min(1),
  phoneNumberId: z.string().min(1),
  displayPhone: z.string().optional(),
  businessName: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const organization = await getCurrentOrganization();
    await requireRole('ADMIN');
    const body = completeSchema.parse(await request.json());
    return Response.json(await whatsappOnboardingService.completeSignup(organization.id, body));
  } catch (error) {
    return errorResponse(error);
  }
}
