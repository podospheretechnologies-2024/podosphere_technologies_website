import type { NextRequest } from 'next/server';
import { portalChangePasswordSchema } from '@/modules/social/server/portal/portal-auth.schema';
import { portalAuthService } from '@/modules/social/server/portal/portal-auth.service';
import { errorResponse } from '@/shared/server/http-error';
import { getPortalSession, setPortalSessionCookie } from '@/shared/server/portal-session';

/** Client sets / replaces their portal password (session required). */
export async function POST(request: NextRequest) {
  try {
    const session = await getPortalSession();
    const body = portalChangePasswordSchema.parse(await request.json());
    await portalAuthService.changePassword(session, body);

    // Password change bumps tokenVersion — mint a fresh session so they stay signed in.
    const token = await portalAuthService.mintSession(session, '7d');
    await setPortalSessionCookie(token, '7d');

    return Response.json({ ok: true, redirectTo: '/portal' });
  } catch (error) {
    return errorResponse(error);
  }
}
