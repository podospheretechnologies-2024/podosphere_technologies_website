import { notificationService } from '@/modules/social/server/notifications/notification.service';
import { getAccess } from '@/shared/server/access';
import { errorResponse, HttpError } from '@/shared/server/http-error';

type RouteContext = { params: Promise<{ id: string }> };

/** Mark a single notification as read. */
export async function PATCH(_request: Request, context: RouteContext) {
  try {
    const access = await getAccess();
    const { id } = await context.params;
    const updated = await notificationService.markRead(access.organization.id, id);
    if (!updated) {
      throw new HttpError(404, 'Notification not found');
    }
    return Response.json(updated);
  } catch (error) {
    return errorResponse(error);
  }
}
