import type { NextRequest } from 'next/server';
import { portalSetPasswordSchema } from '@/modules/social/server/portal/portal-auth.schema';
import { portalAuthService } from '@/modules/social/server/portal/portal-auth.service';
import { errorResponse } from '@/shared/server/http-error';
import { setPortalSessionCookie } from '@/shared/server/portal-session';

/** Consume an emailed set-password link and open a portal session. */
export async function POST(request: NextRequest) {
  try {
    const body = portalSetPasswordSchema.parse(await request.json());
    const session = await portalAuthService.setPasswordFromLink(body);
    const token = await portalAuthService.mintSession(session, '7d');
    await setPortalSessionCookie(token, '7d');
    return Response.json({ ok: true, redirectTo: '/portal' });
  } catch (error) {
    return errorResponse(error);
  }
}
