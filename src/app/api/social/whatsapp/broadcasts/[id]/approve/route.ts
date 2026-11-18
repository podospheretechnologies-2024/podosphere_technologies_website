import type { NextRequest } from 'next/server';
import { broadcastService } from '@/modules/social/server/whatsapp/whatsapp-growth.service';
import { getClientScope } from '@/shared/server/client-scope';
import { errorResponse } from '@/shared/server/http-error';

type Params = { params: Promise<{ id: string }> };

/** Agency: approve a pending client broadcast and send via Meta. */
export async function POST(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const scope = await getClientScope('inbox');
    return Response.json(await broadcastService.approve(scope, id));
  } catch (error) {
    return errorResponse(error);
  }
}
