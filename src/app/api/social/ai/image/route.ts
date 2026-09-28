import type { NextRequest } from 'next/server';
import { generateImageSchema } from '@/modules/social/server/ai/ai.schema';
import { aiService } from '@/modules/social/server/ai/ai.service';
import { getCurrentOrganization } from '@/shared/server/current-organization';
import { errorResponse } from '@/shared/server/http-error';

export async function POST(request: NextRequest) {
  try {
    const organization = await getCurrentOrganization();
    const body = generateImageSchema.parse(await request.json());
    return Response.json(await aiService.generateImage(organization.id, body), { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
