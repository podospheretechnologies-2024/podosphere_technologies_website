import type { NextRequest } from 'next/server';
import {
  uploadFileNameSchema,
} from '@/modules/social/server/media/media.schema';
import { portalBrandService } from '@/modules/social/server/portal/portal-brand.service';
import { requirePortalTab } from '@/modules/social/server/portal/portal-guard';
import { errorResponse } from '@/shared/server/http-error';

/** Client uploads logo / product photos into their own media library. */
export async function POST(request: NextRequest) {
  try {
    const session = await requirePortalTab('brand', 'act');
    const fileName = uploadFileNameSchema.parse(
      decodeURIComponent(request.headers.get('x-file-name') ?? '')
    );
    const declaredSize = Number(request.headers.get('content-length')) || undefined;
    const media = await portalBrandService.uploadMedia(session, {
      fileName,
      body: request.body,
      declaredSize,
    });
    return Response.json(media, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
