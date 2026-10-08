import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { approvalService } from '@/modules/social/server/approvals/approval.service';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get('token');
  
  if (!token) return new NextResponse('Missing token', { status: 400 });

  try {
    const verified = await approvalService.verifyToken(token);
    
    const cookieStore = await cookies();
    cookieStore.set('approver_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    return NextResponse.redirect(new URL('/approver/portal', process.env.APP_URL || req.url));
  } catch (err) {
    return new NextResponse('Invalid or expired magic link', { status: 401 });
  }
}
