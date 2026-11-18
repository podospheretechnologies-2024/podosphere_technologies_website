import { NextResponse, type NextRequest } from 'next/server';
import { shopifyService } from '@/modules/social/server/growth/shopify.service';
import { enqueueStoreSync } from '@/modules/social/server/growth/growth.queue';
import { getServerEnv } from '@/shared/lib/env';
import { getAccess } from '@/shared/server/access';
import { HttpError } from '@/shared/server/http-error';

function toUserMessage(error: unknown): string {
  if (error instanceof HttpError) return error.message;
  console.error('[growth] Shopify OAuth callback failed:', error);
  return 'Could not connect the Shopify store. Please try again.';
}

// Shopify redirects here after the store owner approves; we land back on Growth Desk → Setup.
export async function GET(request: NextRequest) {
  const redirectUrl = new URL('/dashboard/social/growth', getServerEnv().APP_URL);
  redirectUrl.searchParams.set('tab', 'settings');

  try {
    const access = await getAccess();
    const params = request.nextUrl.searchParams;
    const oauthError = params.get('error');
    if (oauthError) throw new HttpError(400, params.get('error_description') || oauthError);

    // The one-time state was created by this same user under the `approve` permission, and
    // completeOAuth rejects any other login or organisation.
    const done = await shopifyService.completeOAuth(access.organization.id, access.user.id, params);
    await enqueueStoreSync(done.storeId).catch((err) => console.error('[growth] enqueue sync failed', err));
    redirectUrl.searchParams.set('shopify', 'connected');
  } catch (error) {
    redirectUrl.searchParams.set('shopifyError', toUserMessage(error));
  }

  return NextResponse.redirect(redirectUrl);
}
