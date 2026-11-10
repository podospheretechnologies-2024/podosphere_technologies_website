import type { NextRequest } from 'next/server';
import { portalBrandService } from '@/modules/social/server/portal/portal-brand.service';
import { requirePortalSessionReady } from '@/shared/server/portal-session';
import { errorResponse } from '@/shared/server/http-error';

export async function GET() {
  try {
    const session = await requirePortalSessionReady();
    return Response.json(await portalBrandService.get(session));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await requirePortalSessionReady();
    const body = (await request.json()) as Record<string, string>;
    return Response.json(await portalBrandService.save(session, body));
  } catch (error) {
    return errorResponse(error);
  }
}
