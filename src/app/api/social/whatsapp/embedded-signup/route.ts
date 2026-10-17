import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { whatsappOnboardingService } from '@/modules/social/server/whatsapp/whatsapp-growth.service';
import { getClientScope } from '@/shared/server/client-scope';
import { errorResponse } from '@/shared/server/http-error';

export async function GET() {
  try {
    const scope = await getClientScope('inbox');
    return Response.json({
      ...whatsappOnboardingService.config(),
      connection: await whatsappOnboardingService.connection(scope),
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
    const scope = await getClientScope('inbox');
    const body = completeSchema.parse(await request.json());
    return Response.json(await whatsappOnboardingService.completeSignup(scope, body));
  } catch (error) {
    return errorResponse(error);
  }
}
