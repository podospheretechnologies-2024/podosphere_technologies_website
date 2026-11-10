import { ga4Service } from '@/modules/social/server/growth/ga4.service';
import { requireRole } from '@/shared/server/access';
import { errorResponse } from '@/shared/server/http-error';

// Starts the Google Analytics OAuth flow (owner / admin only, one login per organization).
export async function GET() {
  try {
    const ctx = await requireRole('ADMIN');
    return Response.json(await ga4Service.getConnectUrl(ctx.organization.id));
  } catch (error) {
    return errorResponse(error);
  }
}
