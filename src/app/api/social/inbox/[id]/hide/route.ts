import { inboxService } from '@/modules/social/server/inbox/inbox.service';
import { getClientScope } from '@/shared/server/client-scope';
import { errorResponse } from '@/shared/server/http-error';

type Context = { params: Promise<{ id: string }> };

export async function POST(_request: Request, ctx: Context) {
  try {
    const scope = await getClientScope('inbox');
    const { id } = await ctx.params;
    return Response.json(await inboxService.hide(scope, id));
  } catch (error) {
    return errorResponse(error);
  }
}
