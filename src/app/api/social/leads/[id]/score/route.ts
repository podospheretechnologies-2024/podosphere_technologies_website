import type { NextRequest } from 'next/server';
import { scoreLeadSchema } from '@/modules/social/server/inbox/inbox.schema';
import { inboxService } from '@/modules/social/server/inbox/inbox.service';
import { getClientScope } from '@/shared/server/client-scope';
import { errorResponse } from '@/shared/server/http-error';

type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, ctx: Context) {
  try {
    const scope = await getClientScope('leads');
    const { id } = await ctx.params;
    const raw = await request.json().catch(() => ({}));
    const body = scoreLeadSchema.parse(raw ?? {});
    return Response.json(await inboxService.scoreLead(scope, id, { pushToCrm: body.pushToCrm }));
  } catch (error) {
    return errorResponse(error);
  }
}
