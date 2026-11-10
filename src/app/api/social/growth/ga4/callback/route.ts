import { NextResponse, type NextRequest } from 'next/server';
import { ga4Service } from '@/modules/social/server/growth/ga4.service';
import { getServerEnv } from '@/shared/lib/env';
import { requireRole } from '@/shared/server/access';
import { HttpError } from '@/shared/server/http-error';

function toUserMessage(error: unknown): string {
  if (error instanceof HttpError) return error.message;
  console.error(error);
  return 'Could not connect Google Analytics. Please try again.';
}

// Google redirects here after consent; we land back on Growth Desk → Setup.
export async function GET(request: NextRequest) {
  const redirectUrl = new URL('/dashboard/social/growth', getServerEnv().APP_URL);
  redirectUrl.searchParams.set('tab', 'settings');

  try {
    const ctx = await requireRole('ADMIN');
    const params = request.nextUrl.searchParams;
    const oauthError = params.get('error');
    if (oauthError) throw new HttpError(400, params.get('error_description') || oauthError);
    const code = params.get('code');
    const state = params.get('state');
    if (!code || !state) throw new HttpError(400, 'Invalid response from Google');
    await ga4Service.completeConnect(ctx.organization.id, code, state);
    redirectUrl.searchParams.set('ga4', 'connected');
  } catch (error) {
    redirectUrl.searchParams.set('ga4Error', toUserMessage(error));
  }

  return NextResponse.redirect(redirectUrl);
}
