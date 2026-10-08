import type { NextRequest } from 'next/server';
import { brandKitSchema, brandKitService } from '@/modules/social/server/ai/brand-kit.service';
import { getCurrentOrganization } from '@/shared/server/current-organization';
import { requireRole } from '@/shared/server/access';
import { errorResponse } from '@/shared/server/http-error';

export async function GET() {
  try {
    const organization = await getCurrentOrganization();
    await requireRole('ADMIN');
    return Response.json(await brandKitService.get(organization.id));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const organization = await getCurrentOrganization();
    await requireRole('ADMIN');
    const body = brandKitSchema.parse(await request.json());
    return Response.json(await brandKitService.save(organization.id, body));
  } catch (error) {
    return errorResponse(error);
  }
}
