import type { NextRequest } from 'next/server';
import { createShortLinkSchema } from '@/modules/social/server/short-links/short-link.schema';
import { shortLinkService } from '@/modules/social/server/short-links/short-link.service';
import { getClientScope } from '@/shared/server/client-scope';
import { errorResponse } from '@/shared/server/http-error';

export async function GET() {
  try {
    const scope = await getClientScope('view');
    return Response.json(await shortLinkService.list(scope));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await getClientScope('draft');
    const body = createShortLinkSchema.parse(await request.json());
    return Response.json(await shortLinkService.create(scope, body), { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
