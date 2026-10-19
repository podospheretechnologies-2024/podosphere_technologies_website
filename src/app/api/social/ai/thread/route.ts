import type { NextRequest } from 'next/server';
import { splitThreadSchema } from '@/modules/social/server/ai/ai.schema';
import { aiService } from '@/modules/social/server/ai/ai.service';
import { getClientScope } from '@/shared/server/client-scope';
import { errorResponse } from '@/shared/server/http-error';

export async function POST(request: NextRequest) {
  try {
    const scope = await getClientScope('draft');
    const body = splitThreadSchema.parse(await request.json());
    return Response.json(await aiService.splitThread(scope, body));
  } catch (error) {
    return errorResponse(error);
  }
}
