import type { NextRequest } from 'next/server';
import { saveHashtagGroupSchema } from '@/modules/social/server/hashtag-groups/hashtag-group.schema';
import { hashtagGroupService } from '@/modules/social/server/hashtag-groups/hashtag-group.service';
import { getClientScope } from '@/shared/server/client-scope';
import { errorResponse } from '@/shared/server/http-error';

export async function GET() {
  try {
    const scope = await getClientScope('view');
    return Response.json(await hashtagGroupService.list(scope));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await getClientScope('draft');
    const body = saveHashtagGroupSchema.parse(await request.json());
    return Response.json(await hashtagGroupService.create(scope, body), { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
