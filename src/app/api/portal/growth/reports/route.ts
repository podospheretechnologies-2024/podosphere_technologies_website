import { portalGrowthReportsService } from '@/modules/social/server/portal/portal-growth-reports.service';
import { requirePortalTab } from '@/modules/social/server/portal/portal-guard';
import { errorResponse } from '@/shared/server/http-error';

export async function GET() {
  try {
    const session = await requirePortalTab('sales', 'view');
    const reports = await portalGrowthReportsService.list(session);
    return Response.json({ reports });
  } catch (error) {
    return errorResponse(error);
  }
}
