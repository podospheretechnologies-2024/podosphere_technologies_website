import { portalSalesService } from '@/modules/social/server/portal/portal-sales.service';
import { requirePortalTab } from '@/modules/social/server/portal/portal-guard';
import { errorResponse } from '@/shared/server/http-error';

/** Client portal Sales — customerId/org only from session. */
export async function GET() {
  try {
    const session = await requirePortalTab('sales', 'view');
    const data = await portalSalesService.summary(session);
    return Response.json(data);
  } catch (error) {
    return errorResponse(error);
  }
}
