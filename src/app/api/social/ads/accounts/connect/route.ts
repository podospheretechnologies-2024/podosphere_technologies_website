import { adsService } from '@/modules/social/server/ads/ads.service';
import { canUseAds } from '@/shared/config/organization';
import { isUnassignedClientId, resolveSelectedClientId } from '@/shared/server/client-scope';
import { requireRole } from '@/shared/server/access';
import { getCurrentOrganization } from '@/shared/server/current-organization';
import { errorResponse, HttpError } from '@/shared/server/http-error';

/** Starts Facebook Login for ads_read + ads_management (ADMIN+). */
export async function GET() {
  try {
    const organization = await getCurrentOrganization();
    await requireRole('ADMIN');
    if (!canUseAds(organization)) throw new HttpError(404, 'Not found');

    const picked = await resolveSelectedClientId();
    // "Unassigned" is a view, not a client: new accounts then stay unassigned.
    const customerId = picked && !isUnassignedClientId(picked) ? picked : null;
    return Response.json(await adsService.getConnectUrl(organization.id, customerId));
  } catch (error) {
    return errorResponse(error);
  }
}
