import type { NextRequest } from 'next/server';
import { urlPostsSchema } from '@/modules/social/server/ai/ai.schema';
import { aiService } from '@/modules/social/server/ai/ai.service';
import { getClientScope } from '@/shared/server/client-scope';
import { errorResponse } from '@/shared/server/http-error';

export async function POST(request: NextRequest) {
  try {
    const scope = await getClientScope('draft');
    const body = urlPostsSchema.parse(await request.json());
    return Response.json(await aiService.generatePostsFromUrl(scope.organizationId, body));
  } catch (error) {
    return errorResponse(error);
  }
}
