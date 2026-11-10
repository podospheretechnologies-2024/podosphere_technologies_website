import { errorResponse } from '@/shared/server/http-error';
import { growthRequest } from '@/modules/social/server/growth/growth-http';
import { generateContentIdeas } from '@/modules/social/server/growth/growth-ai.service';

/** New content ideas from post results; saved as an Idea-box brief so "Add as tasks" works the same. */
export async function POST() {
  try {
    const { gc, userId } = await growthRequest('draft');
    return Response.json(await generateContentIdeas(gc, userId), { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
