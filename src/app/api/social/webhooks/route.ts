import type { NextRequest } from 'next/server';
import { saveWebhookSchema } from '@/modules/social/server/webhooks/webhook.schema';
import { webhookService } from '@/modules/social/server/webhooks/webhook.service';
import { getCurrentOrganization } from '@/shared/server/current-organization';
import { requireRole } from '@/shared/server/access';
import { errorResponse } from '@/shared/server/http-error';

export async function GET() {
  try {
    const organization = await getCurrentOrganization();
    await requireRole('ADMIN');
    return Response.json(await webhookService.list(organization.id));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const organization = await getCurrentOrganization();
    await requireRole('ADMIN');
    const body = saveWebhookSchema.parse(await request.json());
    return Response.json(await webhookService.create(organization.id, body), { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
