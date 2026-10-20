import { adsService } from '@/modules/social/server/ads/ads.service';
import { canUseAds } from '@/shared/config/organization';
import { requireRole } from '@/shared/server/access';
import { getClientScope } from '@/shared/server/client-scope';
import { getCurrentOrganization } from '@/shared/server/current-organization';
import { errorResponse } from '@/shared/server/http-error';

// Assigned ad accounts for the current client scope (agency OWNER/ADMIN only).
export async function GET() {
  try {
    await requireRole('ADMIN');
    const scope = await getClientScope('ads_view');
    const org = await getCurrentOrganization();

    if (!canUseAds(org) || !(await adsService.isConfiguredForOrg(org.id))) {
      return Response.json({ configured: false, accounts: [] });
    }
    return Response.json({ configured: true, accounts: await adsService.listAccounts(scope) });
  } catch (error) {
    return errorResponse(error);
  }
}
