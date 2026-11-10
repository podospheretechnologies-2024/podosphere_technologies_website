import type { NextRequest } from 'next/server';
import { createPortalRequestSchema } from '@/modules/social/server/portal/portal-requests.schema';
import { portalRequestsService } from '@/modules/social/server/portal/portal-requests.service';
import { requirePortalSessionReady } from '@/shared/server/portal-session';
import { errorResponse } from '@/shared/server/http-error';

/** Client portal: list own requests. */
export async function GET() {
  try {
    const session = await requirePortalSessionReady();
    const requests = await portalRequestsService.listForPortal(session);
    return Response.json({ requests });
  } catch (error) {
    return errorResponse(error);
  }
}

/** Client portal: create a request (post / campaign / change / other). */
export async function POST(request: NextRequest) {
  try {
    const session = await requirePortalSessionReady();
    const body = createPortalRequestSchema.parse(await request.json());
    const created = await portalRequestsService.createForPortal(session, body);
    return Response.json({ request: created }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
