import { adsService } from '@/modules/social/server/ads/ads.service';
import { canUseAds } from '@/shared/config/organization';
import { requireRole } from '@/shared/server/access';
import { organizationScope } from '@/shared/server/client-scope';
import { getCurrentOrganization } from '@/shared/server/current-organization';
import { errorResponse } from '@/shared/server/http-error';

/**
 * Agency-level sync from Meta `me/adaccounts` into assigned DB rows.
 * ADMIN only — members use the scoped list, not sync.
 */
export async function POST() {
  try {
    const org = await getCurrentOrganization();
    await requireRole('ADMIN');

    if (!canUseAds(org) || !adsService.isConfigured()) {
      return Response.json({ configured: false, accounts: [] });
    }

    await adsService.syncAccounts(org.id);
    return Response.json({
      success: true,
      accounts: await adsService.listAccounts(organizationScope(org.id)),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
