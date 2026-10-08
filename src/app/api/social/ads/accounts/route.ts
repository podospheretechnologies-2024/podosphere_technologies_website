import { adsService } from '@/modules/social/server/ads/ads.service';
import { getCurrentOrganization } from '@/shared/server/current-organization';
import { requireRole } from '@/shared/server/access';
import { errorResponse } from '@/shared/server/http-error';

// Ad accounts shared with the Business Manager system user (read-only).
export async function GET() {
  try {
    const org = await getCurrentOrganization();
    await requireRole('ADMIN');
    if (org.name !== 'Podosphere Technologies' || !adsService.isConfigured()) {
      return Response.json({ configured: false, accounts: [] });
    }
    return Response.json({ configured: true, accounts: await adsService.listAccounts(org.id) });
  } catch (error) {
    return errorResponse(error);
  }
}
