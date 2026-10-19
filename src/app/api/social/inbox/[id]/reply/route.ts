import type { NextRequest } from 'next/server';
import { replyThreadSchema } from '@/modules/social/server/inbox/inbox.schema';
import { inboxService } from '@/modules/social/server/inbox/inbox.service';
import { getClientScope } from '@/shared/server/client-scope';
import { errorResponse } from '@/shared/server/http-error';

type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, ctx: Context) {
  try {
    const scope = await getClientScope('inbox');
    const { id } = await ctx.params;
    const body = replyThreadSchema.parse(await request.json());
    return Response.json(await inboxService.reply(scope, id, body.text));
  } catch (error) {
    return errorResponse(error);
  }
}
