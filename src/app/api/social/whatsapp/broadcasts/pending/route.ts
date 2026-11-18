import { broadcastService } from '@/modules/social/server/whatsapp/whatsapp-growth.service';
import { getClientScope } from '@/shared/server/client-scope';
import { errorResponse } from '@/shared/server/http-error';

/** Agency: list client-prepared broadcasts waiting for approval (current client scope). */
export async function GET() {
  try {
    const scope = await getClientScope('inbox');
    return Response.json(await broadcastService.listPending(scope));
  } catch (error) {
    return errorResponse(error);
  }
}
