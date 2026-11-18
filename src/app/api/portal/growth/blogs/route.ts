import { portalGrowthBlogsService } from '@/modules/social/server/portal/portal-growth-blogs.service';
import { requirePortalTab } from '@/modules/social/server/portal/portal-guard';
import { errorResponse } from '@/shared/server/http-error';

export async function GET() {
  try {
    const session = await requirePortalTab('sales', 'view');
    const blogs = await portalGrowthBlogsService.list(session);
    return Response.json({ blogs });
  } catch (error) {
    return errorResponse(error);
  }
}
