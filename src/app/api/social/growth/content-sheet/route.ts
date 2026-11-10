import type { NextRequest } from 'next/server';
import { errorResponse } from '@/shared/server/http-error';
import { growthRequest } from '@/modules/social/server/growth/growth-http';
import { contentSheetLinkSchema } from '@/modules/social/server/growth/growth.schema';
import { contentSheetService } from '@/modules/social/server/growth/content-sheet.service';

/** This client's content calendar sheet: planned rows and whether each day is in the Calendar. `?refresh=1` re-reads Google. */
export async function GET(request: NextRequest) {
  try {
    const { gc, isAdmin } = await growthRequest('view');
    const refresh = request.nextUrl.searchParams.get('refresh') === '1';
    return Response.json(await contentSheetService.status(gc, { canConnect: isAdmin, refresh }));
  } catch (error) {
    return errorResponse(error);
  }
}

/** Link (or clear) this client's content calendar sheet and optional tab. */
export async function PUT(request: NextRequest) {
  try {
    const { gc, isAdmin } = await growthRequest('approve');
    const input = contentSheetLinkSchema.parse(await request.json());
    await contentSheetService.setLink(gc, { link: input.link, tab: input.tab ?? null });
    return Response.json(await contentSheetService.status(gc, { canConnect: isAdmin }));
  } catch (error) {
    return errorResponse(error);
  }
}
