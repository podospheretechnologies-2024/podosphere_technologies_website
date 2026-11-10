import { clearPortalSessionCookie } from '@/shared/server/portal-session';
import { errorResponse } from '@/shared/server/http-error';

/** Client portal: clear the approver_session cookie. */
export async function POST() {
  try {
    await clearPortalSessionCookie();
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
