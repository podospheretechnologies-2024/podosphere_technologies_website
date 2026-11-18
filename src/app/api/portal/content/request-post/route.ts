import type { NextRequest } from 'next/server';
import { createPortalPostRequestSchema } from '@/modules/social/server/portal/portal-requests.schema';
import { portalRequestsService } from '@/modules/social/server/portal/portal-requests.service';
import { requirePortalTab } from '@/modules/social/server/portal/portal-guard';
import { errorResponse } from '@/shared/server/http-error';

/** Client portal Calendar: request a new post (needs content "Can act"). */
export async function POST(request: NextRequest) {
  try {
    const session = await requirePortalTab('content', 'act');
    const body = createPortalPostRequestSchema.parse(await request.json());
    const created = await portalRequestsService.createPostRequestForPortal(session, body);
    return Response.json({ request: created }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
