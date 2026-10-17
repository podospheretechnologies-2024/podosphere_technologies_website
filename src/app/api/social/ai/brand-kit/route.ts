import type { NextRequest } from 'next/server';
import { brandKitSchema, brandKitService } from '@/modules/social/server/ai/brand-kit.service';
import { getClientScope } from '@/shared/server/client-scope';
import { errorResponse } from '@/shared/server/http-error';

export async function GET() {
  try {
    const scope = await getClientScope('view');
    return Response.json(await brandKitService.get(scope));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const scope = await getClientScope('draft');
    const body = brandKitSchema.parse(await request.json());
    return Response.json(await brandKitService.save(scope, body));
  } catch (error) {
    return errorResponse(error);
  }
}
