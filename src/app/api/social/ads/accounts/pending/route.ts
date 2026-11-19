import { adsService } from '@/modules/social/server/ads/ads.service';
import { canUseAds } from '@/shared/config/organization';
import { requireRole } from '@/shared/server/access';
import { getCurrentOrganization } from '@/shared/server/current-organization';
import { errorResponse, HttpError } from '@/shared/server/http-error';

/** Pending Meta ad accounts from the latest Facebook Login (token never returned). */
export async function GET() {
  try {
    const organization = await getCurrentOrganization();
    await requireRole('ADMIN');
    if (!canUseAds(organization)) throw new HttpError(404, 'Not found');

    const pending = await adsService.getPendingAccounts(organization.id);
    return Response.json({ pending });
  } catch (error) {
    return errorResponse(error);
  }
}
