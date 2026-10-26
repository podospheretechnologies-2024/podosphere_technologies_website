import type { NextRequest } from 'next/server';
import { saveBioPageSchema } from '@/modules/social/server/bio-pages/bio-page.schema';
import { bioPageService } from '@/modules/social/server/bio-pages/bio-page.service';
import { getClientScope } from '@/shared/server/client-scope';
import { errorResponse } from '@/shared/server/http-error';

export async function GET() {
  try {
    const scope = await getClientScope('view');
    return Response.json(await bioPageService.list(scope));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await getClientScope('draft');
    const body = saveBioPageSchema.parse(await request.json());
    return Response.json(await bioPageService.create(scope, body), { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
