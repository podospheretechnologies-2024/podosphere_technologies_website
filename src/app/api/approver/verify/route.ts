import { NextResponse } from 'next/server';
import { approvalService } from '@/modules/social/server/approvals/approval.service';
import { setPortalSessionCookie } from '@/shared/server/portal-session';

// Redeems a one-time magic link and exchanges it for a short, renewable portal session.
// The link itself is never stored as the session: it is consumed here (single use) and a
// fresh 12h session token is minted instead (see approval.service.ts).
export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get('token');

  if (!token) return new NextResponse('Missing token', { status: 400 });

  try {
    const session = await approvalService.verifyApproverLink(token);
    const sessionToken = await approvalService.createPortalSession(session, '12h');
    await setPortalSessionCookie(sessionToken, '12h');

    const next =
      session.mustChangePassword ? '/approver/change-password' : '/portal';
    return NextResponse.redirect(new URL(next, process.env.APP_URL || req.url));
  } catch {
    return new NextResponse('Invalid or expired magic link', { status: 401 });
  }
}
