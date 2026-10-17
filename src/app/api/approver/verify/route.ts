import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { approvalService } from '@/modules/social/server/approvals/approval.service';
import { APPROVER_SESSION_COOKIE } from '@/shared/server/portal-session';

// Redeems a one-time magic link and exchanges it for a short, renewable portal session.
// The link itself is never stored as the session: it is consumed here (single use) and a
// fresh 12h session token is minted instead (see approval.service.ts).
export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get('token');

  if (!token) return new NextResponse('Missing token', { status: 400 });

  try {
    const session = await approvalService.verifyApproverLink(token);
    const sessionToken = await approvalService.createPortalSession(session);

    const cookieStore = await cookies();
    cookieStore.set(APPROVER_SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 12 * 60 * 60, // 12 hours — matches the session token's own expiry
    });

    return NextResponse.redirect(new URL('/approver/portal', process.env.APP_URL || req.url));
  } catch {
    return new NextResponse('Invalid or expired magic link', { status: 401 });
  }
}
