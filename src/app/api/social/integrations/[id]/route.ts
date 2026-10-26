import type { NextRequest } from 'next/server';
import { updateIntegrationSchema } from '@/modules/social/server/integrations/integration.schema';
import { integrationRepository } from '@/modules/social/server/integrations/integration.repository';
import { integrationService } from '@/modules/social/server/integrations/integration.service';
import { getClientScope } from '@/shared/server/client-scope';
import { errorResponse, HttpError } from '@/shared/server/http-error';

// Disabling or removing a channel is a mutation, so it needs `publish` on the channel's client
// (not bare `view`). OWNER/ADMIN get every client; a member only the clients they can publish to.
// A channel with no client (`customerId = null`, agency-owned) is reachable only with 'all' scope.
async function requireScopedChannel(id: string) {
  const scope = await getClientScope('publish');
  const integration = await integrationRepository.findById(scope.organizationId, id);
  if (!integration) {
    throw new HttpError(404, 'Channel not found');
  }
  if (
    scope.customerIds !== 'all' &&
    (!integration.customerId || !scope.customerIds.includes(integration.customerId))
  ) {
    throw new HttpError(404, 'Channel not found');
  }
  return scope;
}

export async function PATCH(
  request: NextRequest,
  ctx: RouteContext<'/api/social/integrations/[id]'>
) {
  try {
    const { id } = await ctx.params;
    const scope = await requireScopedChannel(id);
    const { disabled } = updateIntegrationSchema.parse(await request.json());
    await integrationService.setDisabled(scope.organizationId, id, disabled);
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
    const scope = await requireScopedChannel(id);
    await integrationService.remove(scope.organizationId, id);
    return new Response(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
