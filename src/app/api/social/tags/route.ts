import type { NextRequest } from 'next/server';
import { saveTagSchema } from '@/modules/social/server/tags/tag.schema';
import { tagService } from '@/modules/social/server/tags/tag.service';
import { getCurrentOrganization } from '@/shared/server/current-organization';
import { errorResponse } from '@/shared/server/http-error';

export async function GET() {
  try {
    const organization = await getCurrentOrganization();
    return Response.json(await tagService.list(organization.id));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const organization = await getCurrentOrganization();
    const body = saveTagSchema.parse(await request.json());
    return Response.json(await tagService.create(organization.id, body), { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
