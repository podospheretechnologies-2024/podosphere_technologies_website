import { toCurrentUserItem } from '@/modules/auth/server/auth.service';
import { getCurrentUser } from '@/modules/auth/server/session';
import { HttpError, errorResponse } from '@/shared/server/http-error';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new HttpError(401, 'Please log in');
    }
    return Response.json(toCurrentUserItem(user));
  } catch (error) {
    return errorResponse(error);
  }
}
