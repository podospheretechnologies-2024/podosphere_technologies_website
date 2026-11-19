import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { adAccountIdSchema } from '@/modules/social/server/ads/ads.schema';
import { adsService } from '@/modules/social/server/ads/ads.service';
import { canUseAds } from '@/shared/config/organization';
import { requireRole } from '@/shared/server/access';
import { resolveSelectedClientId } from '@/shared/server/client-scope';
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
    const selectedClient = await resolveSelectedClientId();
    const customerId =
      body.customerId !== undefined ? body.customerId : selectedClient;

    const result = await adsService.confirmConnectedAccounts(
      organization.id,
      body.accountIds,
      customerId
    );
    return Response.json({ success: true, ...result });
  } catch (error) {
    return errorResponse(error);
  }
}
