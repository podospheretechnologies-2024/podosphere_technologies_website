import type { NextRequest } from 'next/server';
import { generatePostsSchema } from '@/modules/social/server/ai/ai.schema';
import { aiService } from '@/modules/social/server/ai/ai.service';
import { getCurrentOrganization } from '@/shared/server/current-organization';
import { requireRole } from '@/shared/server/access';
import { errorResponse } from '@/shared/server/http-error';

export async function POST(request: NextRequest) {
  try {
    const organization = await getCurrentOrganization();
    await requireRole('ADMIN');
    const body = generatePostsSchema.parse(await request.json());
    return Response.json(await aiService.generatePosts(organization.id, body));
  } catch (error) {
    return errorResponse(error);
  }
}
