import type { NextRequest } from 'next/server';
import { saveAutopostSchema } from '@/modules/social/server/autoposts/autopost.schema';
import { autopostService } from '@/modules/social/server/autoposts/autopost.service';
import { getCurrentOrganization } from '@/shared/server/current-organization';
import { errorResponse } from '@/shared/server/http-error';

export async function GET() {
  try {
    const organization = await getCurrentOrganization();
    return Response.json(await autopostService.list(organization.id));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const organization = await getCurrentOrganization();
    const body = saveAutopostSchema.parse(await request.json());
    return Response.json(await autopostService.create(organization.id, body), { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
