import type { NextRequest } from 'next/server';
import { connectQuerySchema } from '@/modules/social/server/integrations/integration.schema';
import { integrationService } from '@/modules/social/server/integrations/integration.service';
import { requireRole } from '@/shared/server/access';
import { isUnassignedClientId, resolveSelectedClientId } from '@/shared/server/client-scope';
import { getCurrentOrganizationOrClient } from '@/shared/server/current-organization-or-client';
import { errorResponse, HttpError } from '@/shared/server/http-error';
import { prisma } from '@/shared/lib/prisma';

// Returns the provider's OAuth URL; the browser then navigates to it.
// Agency OWNER/ADMIN only — members cannot start channel connections.
export async function GET(
  request: NextRequest,
  ctx: RouteContext<'/api/social/integrations/connect/[provider]'>
) {
  try {
    await requireRole('ADMIN');
    const { provider } = await ctx.params;
    const { organization, customerId } = await getCurrentOrganizationOrClient();
    // PS-01 / R4.1: connect under the client picked in the switcher. R5: with "All clients" or
    // "Unassigned" picked the channel is saved Unassigned (admin-only) — never block the connect.
    const picked = customerId ?? (await resolveSelectedClientId());
    const targetClientId = picked && !isUnassignedClientId(picked) ? picked : undefined;
    if (targetClientId && !customerId) {
      const client = await prisma.socialCustomer.findFirst({
        where: { id: targetClientId, organizationId: organization.id, deletedAt: null },
        select: { id: true },
      });
      if (!client) throw new HttpError(404, 'Client not found');
    }
    const { refresh } = connectQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    return Response.json(
      await integrationService.getConnectUrl(organization.id, provider, refresh, targetClientId, {
        fromPortal: Boolean(customerId),
      })
    );
  } catch (error) {
    return errorResponse(error);
  }
}
