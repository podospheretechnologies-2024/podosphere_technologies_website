import { googleAdsService } from '@/modules/social/server/google-ads/google-ads.service';
import { requireRole } from '@/shared/server/access';
import { errorResponse } from '@/shared/server/http-error';

// Re-discovers the Google Ads accounts reachable from the connected login (admin only).
export async function POST() {
  try {
    const ctx = await requireRole('ADMIN');
    await googleAdsService.refresh(ctx.organization.id);
    return new Response(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
