import type { NextRequest } from 'next/server';
import { portalBrandService } from '@/modules/social/server/portal/portal-brand.service';
import { requirePortalTab } from '@/modules/social/server/portal/portal-guard';
import { errorResponse } from '@/shared/server/http-error';

export async function GET() {
  try {
    const session = await requirePortalTab('brand', 'view');
    return Response.json(await portalBrandService.get(session));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await requirePortalTab('brand', 'act');
    const body = (await request.json()) as Record<string, string>;
    return Response.json(await portalBrandService.save(session, body));
  } catch (error) {
    return errorResponse(error);
  }
}
