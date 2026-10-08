import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { withApiKey } from '@/modules/social/server/api-clients/api-client.service';
import { postService } from '@/modules/social/server/posts/post.service';
import { errorResponse } from '@/shared/server/http-error';

const schema = z.object({
  integrationId: z.string().min(1),
  content: z.string().trim().min(1).max(10000),
  publishAt: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    return await withApiKey('posts:write', request, async ({ organizationId }) => {
      const body = schema.parse(await request.json());
      const created = await postService.create(
        organizationId,
        {
          type: body.publishAt ? 'schedule' : 'draft',
          date: body.publishAt ?? new Date().toISOString(),
          tagIds: [],
          posts: [
            {
              integrationId: body.integrationId,
              values: [{ content: body.content, mediaIds: [], delay: 0 }],
            },
          ],
        },
        'API'
      );
      return Response.json(created, { status: 201 });
    });
  } catch (error) {
    return errorResponse(error);
  }
}
