import type { NextRequest } from 'next/server';
import { errorResponse } from '@/shared/server/http-error';
import { growthRequest } from '@/modules/social/server/growth/growth-http';
import { blogCreateSchema } from '@/modules/social/server/growth/growth.schema';
import { blogsService } from '@/modules/social/server/growth/records.service';
import { generateBlogIdeas } from '@/modules/social/server/growth/growth-ai.service';
import { getSettings } from '@/modules/social/server/growth/growth.service';

export async function GET() {
  try {
    const { gc, canReview } = await growthRequest('view');
    const [blogs, settings] = await Promise.all([
      blogsService.list(gc.organizationId, gc.customerId),
      getSettings(gc.organizationId, gc.customerId),
    ]);
    return Response.json({ blogs, perMonth: settings.blogsPerMonth, canReview });
  } catch (error) {
    return errorResponse(error);
  }
}

/** { generate: true } -> AI topic ideas for the month; { title, angle?, keywords? } -> one idea by hand. */
export async function POST(request: NextRequest) {
  try {
    const { gc } = await growthRequest('draft');
    const input = blogCreateSchema.parse(await request.json());
    if ('title' in input) {
      return Response.json(
        await blogsService.createIdeas(gc.organizationId, gc.customerId, [
          { title: input.title, angle: input.angle ?? undefined, keywords: input.keywords ?? undefined },
        ]),
        { status: 201 }
      );
    }
    return Response.json(await generateBlogIdeas(gc), { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
