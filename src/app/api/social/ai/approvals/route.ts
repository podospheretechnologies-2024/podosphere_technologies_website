import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { postService } from '@/modules/social/server/posts/post.service';
import { prisma } from '@/shared/lib/prisma';
import { getClientScope, scopeWhere } from '@/shared/server/client-scope';
import { errorResponse, HttpError, methodNotAllowed } from '@/shared/server/http-error';

const bodySchema = z.object({
  content: z.string().trim().min(1).max(10000),
  integrationId: z.string().min(1).optional(),
});

export function GET() {
  return methodNotAllowed('POST');
}

export async function POST(request: NextRequest) {
  try {
    const scope = await getClientScope('draft');
    const body = bodySchema.parse(await request.json());
    const integration = body.integrationId
      ? await prisma.socialIntegration.findFirst({
          where: { id: body.integrationId, ...scopeWhere(scope), deletedAt: null },
        })
      : await prisma.socialIntegration.findFirst({
          where: { ...scopeWhere(scope), deletedAt: null, disabled: false },
          orderBy: { createdAt: 'asc' },
        });
    if (!integration) {
      throw new HttpError(400, 'Connect a channel before sending a draft for approval');
    }
    const created = await postService.create(scope, {
      type: 'draft',
      date: new Date().toISOString(),
      tagIds: [],
      posts: [{ integrationId: integration.id, values: [{ content: body.content, mediaIds: [], delay: 0 }] }],
    }, 'AI');
    return Response.json({ ...created, state: 'draft' });
  } catch (error) {
    return errorResponse(error);
  }
}
