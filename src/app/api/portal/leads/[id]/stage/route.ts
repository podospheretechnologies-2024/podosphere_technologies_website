import type { NextRequest } from 'next/server';
import { updatePortalLeadStageSchema } from '@/modules/social/server/portal/portal-leads.schema';
import { portalLeadsService } from '@/modules/social/server/portal/portal-leads.service';
import { requirePortalTab } from '@/modules/social/server/portal/portal-guard';
import { errorResponse } from '@/shared/server/http-error';

type Params = { params: Promise<{ id: string }> };

/** Client portal: change stage on one of their own leads. */
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const session = await requirePortalTab('leads', 'act');
    const { id } = await params;
    const body = updatePortalLeadStageSchema.parse(await request.json());
    const lead = await portalLeadsService.updateStage(session, id, body.stage);
    return Response.json({ lead });
  } catch (error) {
    return errorResponse(error);
  }
}
