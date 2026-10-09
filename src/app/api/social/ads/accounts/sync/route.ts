import { adsService } from '@/modules/social/server/ads/ads.service';
import { canUseAds } from '@/shared/config/organization';
import { getCurrentOrganization } from '@/shared/server/current-organization';
import { requireRole } from '@/shared/server/access';
import { errorResponse } from '@/shared/server/http-error';

// Sync Ad Accounts from Meta
export async function POST() {
  try {
    const org = await getCurrentOrganization();
    await requireRole('ADMIN');
    
    if (!canUseAds(org) || !adsService.isConfigured()) {
      return Response.json({ configured: false, accounts: [] });
    }
    
    await adsService.syncAccounts(org.id);
    return Response.json({ success: true, accounts: await adsService.listAccounts(org.id) });
  } catch (error) {
    return errorResponse(error);
  }
}
