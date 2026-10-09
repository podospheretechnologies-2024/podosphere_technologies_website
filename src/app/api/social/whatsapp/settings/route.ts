import type { NextRequest } from 'next/server';
import { whatsappOnboardingService } from '@/modules/social/server/whatsapp/whatsapp-growth.service';
import { getCurrentOrganization } from '@/shared/server/current-organization';
import { requireRole } from '@/shared/server/access';
import { errorResponse } from '@/shared/server/http-error';

export async function GET() {
  try {
    const organization = await getCurrentOrganization();
    await requireRole('ADMIN');
    return Response.json(await whatsappOnboardingService.getAccountHealth(organization.id));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const organization = await getCurrentOrganization();
    await requireRole('ADMIN');
    const { webhookUrl } = await request.json();
    if (!webhookUrl) return new Response('Missing webhookUrl', { status: 400 });
    
    return Response.json(await whatsappOnboardingService.configureWebhooks(organization.id, webhookUrl));
  } catch (error) {
    return errorResponse(error);
  }
}
