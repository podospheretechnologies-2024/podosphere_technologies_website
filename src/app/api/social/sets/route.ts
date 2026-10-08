import type { NextRequest } from 'next/server';
import { createSetSchema } from '@/modules/social/server/sets/set.schema';
import { setService } from '@/modules/social/server/sets/set.service';
import { getCurrentOrganization } from '@/shared/server/current-organization';
import { requireRole } from '@/shared/server/access';
import { errorResponse } from '@/shared/server/http-error';

export async function GET() {
  try {
    const organization = await getCurrentOrganization();
    await requireRole('ADMIN');
    return Response.json(await setService.list(organization.id));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const organization = await getCurrentOrganization();
    await requireRole('ADMIN');
    const body = createSetSchema.parse(await request.json());
    return Response.json(await setService.create(organization.id, body), { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
