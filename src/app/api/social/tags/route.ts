import type { NextRequest } from 'next/server';
import { saveTagSchema } from '@/modules/social/server/tags/tag.schema';
import { tagService } from '@/modules/social/server/tags/tag.service';
import { getClientScope } from '@/shared/server/client-scope';
import { errorResponse } from '@/shared/server/http-error';

export async function GET() {
  try {
    const scope = await getClientScope('view');
    return Response.json(await tagService.list(scope));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await getClientScope('draft');
    const body = saveTagSchema.parse(await request.json());
    return Response.json(await tagService.create(scope, body), { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
