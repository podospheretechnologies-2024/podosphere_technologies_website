import type { NextRequest } from 'next/server';
import {
  listMediaQuerySchema,
  uploadFileNameSchema,
  uploadFormatSchema,
} from '@/modules/social/server/media/media.schema';
import { mediaService } from '@/modules/social/server/media/media.service';
import { getCurrentOrganization } from '@/shared/server/current-organization';
import { errorResponse } from '@/shared/server/http-error';

export async function GET(request: NextRequest) {
  try {
    const organization = await getCurrentOrganization();
    const query = listMediaQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    return Response.json(await mediaService.list(organization.id, query));
  } catch (error) {
    return errorResponse(error);
  }
}

// The raw file is sent as the request body so large videos are streamed to
// storage instead of being buffered in memory.
export async function POST(request: NextRequest) {
  try {
    const organization = await getCurrentOrganization();
    const fileName = uploadFileNameSchema.parse(
      decodeURIComponent(request.headers.get('x-file-name') ?? '')
    );
    const format = uploadFormatSchema.parse(request.headers.get('x-media-format') ?? undefined);
    const declaredSize = Number(request.headers.get('content-length')) || undefined;

    const media = await mediaService.upload({
      organizationId: organization.id,
      fileName,
      body: request.body,
      declaredSize,
      format,
    });

    return Response.json(media, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
