import type { NextRequest } from 'next/server';
import { saveWebhookSchema } from '@/modules/social/server/webhooks/webhook.schema';
import { webhookService } from '@/modules/social/server/webhooks/webhook.service';
import { getCurrentOrganization } from '@/shared/server/current-organization';
import { requireRole } from '@/shared/server/access';
import { errorResponse } from '@/shared/server/http-error';

export async function PUT(request: NextRequest, ctx: RouteContext<'/api/social/webhooks/[id]'>) {
  try {
    const { id } = await ctx.params;
    const organization = await getCurrentOrganization();
    await requireRole('ADMIN');
    const body = saveWebhookSchema.parse(await request.json());
    return Response.json(await webhookService.update(organization.id, id, body));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  ctx: RouteContext<'/api/social/webhooks/[id]'>
) {
  try {
    const { id } = await ctx.params;
    const organization = await getCurrentOrganization();
    await requireRole('ADMIN');
    await webhookService.remove(organization.id, id);
    return new Response(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
