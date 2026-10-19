import type { NextRequest } from 'next/server';
import { saveSavedReplySchema } from '@/modules/social/server/saved-replies/saved-reply.schema';
import { savedReplyService } from '@/modules/social/server/saved-replies/saved-reply.service';
import { getClientScope } from '@/shared/server/client-scope';
import { errorResponse } from '@/shared/server/http-error';

export async function GET() {
  try {
    const scope = await getClientScope('inbox');
    return Response.json(await savedReplyService.list(scope));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await getClientScope('inbox');
    const body = saveSavedReplySchema.parse(await request.json());
    return Response.json(await savedReplyService.create(scope, body), { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
