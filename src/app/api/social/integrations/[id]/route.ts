import type { NextRequest } from 'next/server';
import { updateIntegrationSchema } from '@/modules/social/server/integrations/integration.schema';
import { integrationService } from '@/modules/social/server/integrations/integration.service';
import { getCurrentOrganization } from '@/shared/server/current-organization';
import { requireRole } from '@/shared/server/access';
import { errorResponse } from '@/shared/server/http-error';

export async function PATCH(
  request: NextRequest,
  ctx: RouteContext<'/api/social/integrations/[id]'>
) {
  try {
    const { id } = await ctx.params;
    const organization = await getCurrentOrganization();
    await requireRole('ADMIN');
    const { disabled } = updateIntegrationSchema.parse(await request.json());
    await integrationService.setDisabled(organization.id, id, disabled);
    return new Response(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  ctx: RouteContext<'/api/social/integrations/[id]'>
) {
  try {
    const { id } = await ctx.params;
    const organization = await getCurrentOrganization();
    await requireRole('ADMIN');
    await integrationService.remove(organization.id, id);
    return new Response(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
