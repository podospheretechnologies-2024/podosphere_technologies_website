import type { NextRequest } from 'next/server';
import { whatsappOnboardingService } from '@/modules/social/server/whatsapp/whatsapp-growth.service';
import { requireRole } from '@/shared/server/access';
import { getClientScope } from '@/shared/server/client-scope';
import { errorResponse } from '@/shared/server/http-error';

export async function GET() {
  try {
    const scope = await getClientScope('inbox');
    return Response.json(await whatsappOnboardingService.getAccountHealth(scope));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireRole('ADMIN');
    const scope = await getClientScope('inbox');
    const { webhookUrl } = await request.json();
    if (!webhookUrl) return new Response('Missing webhookUrl', { status: 400 });

    return Response.json(await whatsappOnboardingService.configureWebhooks(scope, webhookUrl));
  } catch (error) {
    return errorResponse(error);
  }
}
