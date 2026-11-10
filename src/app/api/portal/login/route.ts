import type { NextRequest } from 'next/server';
import { portalLoginSchema } from '@/modules/social/server/portal/portal-auth.schema';
import { portalAuthService } from '@/modules/social/server/portal/portal-auth.service';
import { errorResponse } from '@/shared/server/http-error';
import { setPortalSessionCookie } from '@/shared/server/portal-session';

export async function POST(request: NextRequest) {
  try {
    const body = portalLoginSchema.parse(await request.json());
    const host = request.headers.get('host');
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
    const { session, ttl } = await portalAuthService.login(body, { host, ip });
    const token = await portalAuthService.mintSession(session, ttl);
    await setPortalSessionCookie(token, ttl);

    return Response.json({
      mustChangePassword: session.mustChangePassword,
      redirectTo: session.mustChangePassword ? '/approver/change-password' : '/portal',
    });
  } catch (error) {
    return errorResponse(error);
  }
}
