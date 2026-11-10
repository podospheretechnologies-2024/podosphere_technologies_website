import type { NextRequest } from 'next/server';
import { errorResponse } from '@/shared/server/http-error';
import { growthRequest } from '@/modules/social/server/growth/growth-http';
import { taskCreateSchema } from '@/modules/social/server/growth/growth.schema';
import { tasksService } from '@/modules/social/server/growth/tasks.service';

export async function GET() {
  try {
    const { gc, canReview } = await growthRequest('view');
    const [tasks, people] = await Promise.all([
      tasksService.list(gc.organizationId, gc.customerId),
      tasksService.assignees(gc.organizationId),
    ]);
    return Response.json({ tasks, people, canReview });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { gc, userId } = await growthRequest('draft');
    const input = taskCreateSchema.parse(await request.json());
    return Response.json(
      await tasksService.create(gc.organizationId, gc.customerId, { ...input, source: 'manual' }, userId),
      { status: 201 }
    );
  } catch (error) {
    return errorResponse(error);
  }
}
