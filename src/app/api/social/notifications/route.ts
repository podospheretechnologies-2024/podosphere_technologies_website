import type { NextRequest } from 'next/server';
import { notificationService } from '@/modules/social/server/notifications/notification.service';
import { getAccess } from '@/shared/server/access';
import { errorResponse } from '@/shared/server/http-error';

export async function GET(request: NextRequest) {
  try {
    const access = await getAccess();
    const unreadOnly = request.nextUrl.searchParams.get('unread') === '1';
    const limitParam = request.nextUrl.searchParams.get('limit');
    const limit = limitParam ? Number.parseInt(limitParam, 10) : undefined;

    return Response.json(
      await notificationService.list(access.organization.id, {
        unreadOnly,
        limit: Number.isFinite(limit) ? limit : undefined,
      })
    );
  } catch (error) {
    return errorResponse(error);
  }
}

/** Mark all unread notifications as read for the current organization. */
export async function PATCH() {
  try {
    const access = await getAccess();
    return Response.json(await notificationService.markAllRead(access.organization.id));
  } catch (error) {
    return errorResponse(error);
  }
}
