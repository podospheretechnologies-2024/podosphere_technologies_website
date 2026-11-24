import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { adAccountIdSchema } from '@/modules/social/server/ads/ads.schema';
import { adsService } from '@/modules/social/server/ads/ads.service';
import { canUseAds } from '@/shared/config/organization';
import { requireRole } from '@/shared/server/access';
import { isUnassignedClientId } from '@/shared/server/client-scope';
import { prisma } from '@/shared/lib/prisma';
import { getCurrentOrganization } from '@/shared/server/current-organization';
import { errorResponse, HttpError } from '@/shared/server/http-error';

const bodySchema = z.object({
  accountIds: z.array(adAccountIdSchema).min(1).max(50),
  customerId: z.string().min(1).max(64).nullable().optional(),
});

/** Saves the ad accounts the user ticked after Facebook Login. */
export async function POST(request: NextRequest) {
  try {
    const organization = await getCurrentOrganization();
    await requireRole('ADMIN');
    if (!canUseAds(organization)) throw new HttpError(404, 'Not found');

    const body = bodySchema.parse(await request.json());
    // PS-04: only a client named in the request overrides an account's current client. Without one,
    // the client picked when the connect started applies to new / Unassigned accounts only.
    if (body.customerId && isUnassignedClientId(body.customerId)) body.customerId = null;
    if (body.customerId) {
      const client = await prisma.socialCustomer.findFirst({
        where: { id: body.customerId, organizationId: organization.id, deletedAt: null },
        select: { id: true },
      });
      if (!client) throw new HttpError(404, 'Client not found');
    }

    const result = await adsService.confirmConnectedAccounts(
      organization.id,
      body.accountIds,
      body.customerId
    );
    return Response.json({ success: true, ...result });
  } catch (error) {
    return errorResponse(error);
  }
}
