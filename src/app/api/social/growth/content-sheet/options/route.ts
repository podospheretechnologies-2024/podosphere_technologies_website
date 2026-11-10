import { errorResponse } from '@/shared/server/http-error';
import { growthRequest } from '@/modules/social/server/growth/growth-http';
import { contentSheetService } from '@/modules/social/server/growth/content-sheet.service';

/** Spreadsheets the agency Google login can see (names and tabs only), for the Setup picker. */
export async function GET() {
  try {
    const { gc } = await growthRequest('approve');
    return Response.json({ sheets: await contentSheetService.options(gc.organizationId) });
  } catch (error) {
    return errorResponse(error);
  }
}
