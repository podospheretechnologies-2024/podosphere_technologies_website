import type { NextRequest } from 'next/server';
import { createSetSchema } from '@/modules/social/server/sets/set.schema';
import { setService } from '@/modules/social/server/sets/set.service';
import { getClientScope } from '@/shared/server/client-scope';
import { errorResponse } from '@/shared/server/http-error';

export async function GET() {
  try {
    const scope = await getClientScope('view');
    return Response.json(await setService.list(scope));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await getClientScope('draft');
    const body = createSetSchema.parse(await request.json());
    return Response.json(await setService.create(scope, body), { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
