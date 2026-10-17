import type { NextRequest } from 'next/server';
import { updateLeadStageSchema } from '@/modules/social/server/inbox/inbox.schema';
import { inboxService } from '@/modules/social/server/inbox/inbox.service';
import { getClientScope } from '@/shared/server/client-scope';
import { errorResponse } from '@/shared/server/http-error';

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, ctx: Context) {
  try {
    const scope = await getClientScope('leads');
    const { id } = await ctx.params;
    const { stage } = updateLeadStageSchema.parse(await request.json());
    return Response.json(await inboxService.updateLeadStage(scope, id, stage));
  } catch (error) {
    return errorResponse(error);
  }
}
