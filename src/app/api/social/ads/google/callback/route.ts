import { NextResponse, type NextRequest } from 'next/server';
import { socialSections } from '@/modules/social/config/navigation';
import { googleAdsService } from '@/modules/social/server/google-ads/google-ads.service';
import { getServerEnv } from '@/shared/lib/env';
import { requireRole } from '@/shared/server/access';
import { getCurrentOrganization } from '@/shared/server/current-organization';
import { HttpError } from '@/shared/server/http-error';

function toUserMessage(error: unknown): string {
  if (error instanceof HttpError) return error.message;
  console.error(error);
  return 'Could not connect Google Ads. Please try again.';
}

export async function GET(request: NextRequest) {
  const redirectUrl = new URL(socialSections.ads.href, getServerEnv().APP_URL);
  redirectUrl.searchParams.set('platform', 'google');

  try {
    const organization = await getCurrentOrganization();
    await requireRole('ADMIN');
    const code = request.nextUrl.searchParams.get('code');
    const state = request.nextUrl.searchParams.get('state');
    const oauthError = request.nextUrl.searchParams.get('error');

    if (oauthError) {
      throw new HttpError(400, request.nextUrl.searchParams.get('error_description') || oauthError);
    }
    if (!code || !state) throw new HttpError(400, 'Invalid response from Google');

    await googleAdsService.completeConnect(organization.id, code, state);
    redirectUrl.searchParams.set('googleAds', 'connected');
  } catch (error) {
    redirectUrl.searchParams.set('error', toUserMessage(error));
  }

  return NextResponse.redirect(redirectUrl);
}
