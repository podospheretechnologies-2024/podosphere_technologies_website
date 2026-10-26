import type { NextRequest } from 'next/server';
import { competitorContentSchema } from '@/modules/social/server/ai/ai.schema';
import { aiService } from '@/modules/social/server/ai/ai.service';
import { getClientScope } from '@/shared/server/client-scope';
import { errorResponse } from '@/shared/server/http-error';

export async function POST(request: NextRequest) {
  try {
    const scope = await getClientScope('draft');
    const body = competitorContentSchema.parse(await request.json());
    return Response.json(await aiService.generateFromCompetitor(scope, body));
  } catch (error) {
    return errorResponse(error);
  }
}
