import type { NextRequest } from 'next/server';
import { splitThreadSchema } from '@/modules/social/server/ai/ai.schema';
import { aiService } from '@/modules/social/server/ai/ai.service';
import { getCurrentOrganization } from '@/shared/server/current-organization';
import { errorResponse } from '@/shared/server/http-error';

export async function POST(request: NextRequest) {
  try {
    const organization = await getCurrentOrganization();
    const body = splitThreadSchema.parse(await request.json());
    return Response.json(await aiService.splitThread(organization.id, body));
  } catch (error) {
    return errorResponse(error);
  }
}
