import type { NextRequest } from 'next/server';
import { connectQuerySchema } from '@/modules/social/server/integrations/integration.schema';
import { integrationService } from '@/modules/social/server/integrations/integration.service';
import { getCurrentOrganization } from '@/shared/server/current-organization';
import { errorResponse } from '@/shared/server/http-error';

// Returns the provider's OAuth URL; the browser then navigates to it.
export async function GET(
  request: NextRequest,
  ctx: RouteContext<'/api/social/integrations/connect/[provider]'>
) {
  try {
    const { provider } = await ctx.params;
    const organization = await getCurrentOrganization();
    const { refresh } = connectQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    return Response.json(
      await integrationService.getConnectUrl(organization.id, provider, refresh)
    );
  } catch (error) {
    return errorResponse(error);
  }
}
