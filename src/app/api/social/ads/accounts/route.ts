import { adsService } from '@/modules/social/server/ads/ads.service';
import { getCurrentOrganization } from '@/shared/server/current-organization';
import { errorResponse } from '@/shared/server/http-error';

// Ad accounts shared with the Business Manager system user (read-only).
export async function GET() {
  try {
    await getCurrentOrganization();
    if (!adsService.isConfigured()) {
      return Response.json({ configured: false, accounts: [] });
    }
    return Response.json({ configured: true, accounts: await adsService.listAccounts() });
  } catch (error) {
    return errorResponse(error);
  }
}
