import 'server-only';
import { cookies } from 'next/headers';
import {
  approvalService,
  portalSessionMaxAge,
  type PortalSession,
  type PortalSessionTtl,
} from '@/modules/social/server/approvals/approval.service';
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
    throw new HttpError(401, 'Please log in to the client portal');
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

/** Write the portal session cookie. `ttl` must match the JWT expiry from `createPortalSession`. */
export async function setPortalSessionCookie(token: string, ttl: PortalSessionTtl): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(APPROVER_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: portalSessionMaxAge(ttl),
  });
}

export async function clearPortalSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(APPROVER_SESSION_COOKIE);
}

/**
 * Portal actions other than password change: refuse until the client replaces a generated password.
 * Agency "Login as client" (agencyPreview) is allowed through so staff can review the portal.
 */
export async function requirePortalSessionReady(): Promise<PortalSession> {
  const session = await getPortalSession();
  if (session.mustChangePassword && !session.agencyPreview) {
    throw new HttpError(403, 'Set your own password before continuing');
  }
  return session;
}
