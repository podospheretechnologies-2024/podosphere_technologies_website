import type { NextRequest } from 'next/server';
import { assignThreadSchema } from '@/modules/social/server/inbox/inbox.schema';
import { inboxService } from '@/modules/social/server/inbox/inbox.service';
import { getClientScope } from '@/shared/server/client-scope';
import { errorResponse, HttpError } from '@/shared/server/http-error';

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Context) {
  try {
    const scope = await getClientScope('inbox');
    const { id } = await ctx.params;
    const thread = await inboxService.getThread(scope, id);
    if (!thread) {
      throw new HttpError(404, 'Thread not found');
    }
    return Response.json(thread);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: NextRequest, ctx: Context) {
  try {
    const scope = await getClientScope('inbox');
    const { id } = await ctx.params;
    const body = assignThreadSchema.parse(await request.json());
    return Response.json(await inboxService.assignThread(scope, id, body));
  } catch (error) {
    return errorResponse(error);
  }
}
