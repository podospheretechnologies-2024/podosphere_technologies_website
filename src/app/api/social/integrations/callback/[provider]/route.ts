import { NextResponse, type NextRequest } from 'next/server';
import { socialSections } from '@/modules/social/config/navigation';
import { ProviderError } from '@/modules/social/server/integrations/core/provider.errors';
import { callbackQuerySchema } from '@/modules/social/server/integrations/integration.schema';
import { integrationService } from '@/modules/social/server/integrations/integration.service';
import { getServerEnv } from '@/shared/lib/env';
import { getCurrentOrganizationOrClient } from '@/shared/server/current-organization-or-client';
import { HttpError } from '@/shared/server/http-error';

function toUserMessage(error: unknown): string {
  if (error instanceof HttpError || error instanceof ProviderError) {
    return error.message;
  }
  console.error(error);
  return 'Could not connect the channel. Please try again.';
}

// The provider redirects the user here after they approve (or cancel) access.
export async function GET(
  request: NextRequest,
  ctx: RouteContext<'/api/social/integrations/callback/[provider]'>
) {
  let redirectUrl = new URL(socialSections.channels.href, getServerEnv().APP_URL);

  try {
    const { provider } = await ctx.params;
    const { organization } = await getCurrentOrganizationOrClient();
    const query = callbackQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
    if (!query.success) {
      throw new HttpError(400, 'Invalid response from the provider');
    }

    const { integrations, fromPortal, pendingPages } = await integrationService.completeConnect(
      organization.id,
      provider,
      query.data
    );

    // Only a connect started from the client portal goes back to the portal. An agency connect with
    // a client picked in the switcher stays on the agency Channels page.
    if (fromPortal) {
      redirectUrl = new URL('/portal/channels', getServerEnv().APP_URL);
    }

    if (pendingPages) {
      // PS-01: Meta returned several Pages; the admin ticks the ones to save.
      redirectUrl.searchParams.set('pickPages', provider);
    } else {
      redirectUrl.searchParams.set(
        'connected',
        integrations.map((integration) => integration.name).join(', ')
      );
    }
  } catch (error) {
    redirectUrl.searchParams.set('error', toUserMessage(error));
  }

  return NextResponse.redirect(redirectUrl);
}
