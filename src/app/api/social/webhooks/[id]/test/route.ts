import type { NextRequest } from 'next/server';
import { webhookService } from '@/modules/social/server/webhooks/webhook.service';
import { getCurrentOrganization } from '@/shared/server/current-organization';
import { errorResponse } from '@/shared/server/http-error';

export async function POST(
  _request: NextRequest,
  ctx: RouteContext<'/api/social/webhooks/[id]/test'>
) {
  try {
    const { id } = await ctx.params;
    const organization = await getCurrentOrganization();
    return Response.json(await webhookService.test(organization.id, id));
  } catch (error) {
    return errorResponse(error);
  }
}
