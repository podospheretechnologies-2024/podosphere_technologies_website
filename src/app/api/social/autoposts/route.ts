import type { NextRequest } from 'next/server';
import { saveAutopostSchema } from '@/modules/social/server/autoposts/autopost.schema';
import { autopostService } from '@/modules/social/server/autoposts/autopost.service';
import { getClientScope } from '@/shared/server/client-scope';
import { errorResponse } from '@/shared/server/http-error';

export async function GET() {
  try {
    const scope = await getClientScope('view');
    return Response.json(await autopostService.list(scope));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await getClientScope('publish');
    const body = saveAutopostSchema.parse(await request.json());
    return Response.json(await autopostService.create(scope, body), { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
