import 'server-only';
import { cookies } from 'next/headers';
import { approvalService, type PortalSession } from '@/modules/social/server/approvals/approval.service';
import { HttpError } from './http-error';

export const APPROVER_SESSION_COOKIE = 'approver_session';

/**
 * One place to read and verify the client portal's session cookie (see PODO_SOCIAL_CLIENT_PLAN.md,
 * section 8.2, problem C8 — every `/api/approver/*` route and the portal page used to duplicate
 * this). Throws `HttpError(401)` when there is no cookie, it's expired, or the approver no longer
 * exists/was revoked.
 */
export async function getPortalSession(): Promise<PortalSession> {
  const cookieStore = await cookies();
  const token = cookieStore.get(APPROVER_SESSION_COOKIE)?.value;
  if (!token) {
    throw new HttpError(401, 'Please use your magic link to sign in');
  }
  return approvalService.verifyPortalSession(token);
}

/** Same as `getPortalSession`, but returns null instead of throwing — for pages that render their own "please sign in" state. */
export async function getPortalSessionOrNull(): Promise<PortalSession | null> {
  try {
    return await getPortalSession();
  } catch {
    return null;
  }
}
