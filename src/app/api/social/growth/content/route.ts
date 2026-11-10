import { errorResponse } from '@/shared/server/http-error';
import { growthRequest } from '@/modules/social/server/growth/growth-http';
import { contentService } from '@/modules/social/server/growth/records.service';
import { getSettings } from '@/modules/social/server/growth/growth.service';

export async function GET() {
  try {
    const { gc } = await growthRequest('view');
    const [posts, settings] = await Promise.all([
      contentService.tracker(gc.organizationId, gc.customerId),
      getSettings(gc.organizationId, gc.customerId),
    ]);
    return Response.json({ posts, contentSheetUrl: settings.contentSheetUrl });
  } catch (error) {
    return errorResponse(error);
  }
}
