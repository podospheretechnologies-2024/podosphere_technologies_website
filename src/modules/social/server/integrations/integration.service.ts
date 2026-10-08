import 'server-only';
import type { SocialIntegration } from '@/generated/prisma/client';
import { decrypt, encrypt } from '@/shared/lib/crypto';
import { prisma } from '@/shared/lib/prisma';
import { getServerEnv } from '@/shared/lib/env';
import { HttpError } from '@/shared/server/http-error';
import { logAudit } from '@/shared/server/audit.service';
import type {
  AvailableProvider,
  ChannelItem,
  ChannelsResponse,
  ConnectUrlResponse,
} from '../../types/integration';
import { integrationRegistry } from './core/integration.registry';
import { ProviderError, RefreshTokenError } from './core/provider.errors';
import type { AuthTokenDetails, SocialProvider } from './core/social-provider.interface';
import { integrationRepository } from './integration.repository';
import type { CallbackQuery } from './integration.schema';
import { oauthStateStore } from './oauth-state';
import { getIntegrationQueue, INTEGRATION_JOB } from './integration.queue';

// Refresh tokens this long before they expire so a scheduled post never uses a stale one.
const REFRESH_BUFFER_MS = 10 * 60 * 1000;
// The refresh job renews every token that expires within this window.
const TOKEN_REFRESH_WINDOW_MS = 24 * 60 * 60 * 1000;

type ChannelRow = Awaited<ReturnType<typeof integrationRepository.list>>[number];

function getRedirectUri(identifier: string): string {
  return new URL(
    `/api/social/integrations/callback/${identifier}`,
    getServerEnv().APP_URL
  ).toString();
}

function getProviderOrThrow(identifier: string): SocialProvider {
  const provider = integrationRegistry.get(identifier);
  if (!provider) {
    throw new HttpError(404, `Unknown channel provider "${identifier}"`);
  }
  return provider;
}

function toTokenFields(details: AuthTokenDetails) {
  return {
    accessToken: encrypt(details.accessToken),
    refreshToken: details.refreshToken ? encrypt(details.refreshToken) : null,
    tokenExpiration: details.expiresIn ? new Date(Date.now() + details.expiresIn * 1000) : null,
  };
}

function toChannelItem(row: ChannelRow): ChannelItem {
  return {
    id: row.id,
    providerIdentifier: row.providerIdentifier,
    providerName: integrationRegistry.get(row.providerIdentifier)?.name ?? row.providerIdentifier,
    name: row.name,
    username: row.username,
    picture: row.picture,
    disabled: row.disabled,
    refreshNeeded: row.refreshNeeded,
    inBetweenSteps: row.inBetweenSteps,
    customer: row.customer,
    createdAt: row.createdAt.toISOString(),
  };
}

function toAvailableProvider(provider: SocialProvider): AvailableProvider {
  return {
    identifier: provider.identifier,
    name: provider.name,
    configured: provider.isConfigured(),
    requiredEnv: [...provider.requiredEnv],
    maxLength: provider.maxLength(),
  };
}

const EXTRA_CHANNEL_PROVIDERS: AvailableProvider[] = [
  {
    identifier: 'whatsapp',
    name: 'WhatsApp',
    configured: true,
    requiredEnv: [],
    maxLength: 4096,
  },
  {
    identifier: 'youtube',
    name: 'YouTube',
    configured: false,
    requiredEnv: [],
    maxLength: 0,
    comingSoon: true,
  },
  {
    identifier: 'pinterest',
    name: 'Pinterest',
    configured: false,
    requiredEnv: [],
    maxLength: 0,
    comingSoon: true,
  },
];

export const integrationService = {
  async list(organizationId: string): Promise<ChannelsResponse> {
    const rows = await integrationRepository.list(organizationId);
    return {
      channels: rows.map(toChannelItem),
      providers: [...integrationRegistry.list().map(toAvailableProvider), ...EXTRA_CHANNEL_PROVIDERS],
    };
  },

  async getConnectUrl(
    organizationId: string,
    identifier: string,
    refreshIntegrationId?: string,
    customerId?: string
  ): Promise<ConnectUrlResponse> {
    const provider = getProviderOrThrow(identifier);
    if (!provider.isConfigured()) {
      throw new HttpError(
        400,
        `${provider.name} is not configured. Set ${provider.requiredEnv.join(' and ')} in .env.`
      );
    }

    if (refreshIntegrationId) {
      const existing = await integrationRepository.findById(organizationId, refreshIntegrationId);
      if (!existing || existing.providerIdentifier !== identifier) {
        throw new HttpError(404, 'Channel not found');
      }
    }

    const { url, state, codeVerifier } = await provider.generateAuthUrl(getRedirectUri(identifier));
    await oauthStateStore.save(state, {
      organizationId,
      providerIdentifier: identifier,
      codeVerifier,
      refreshIntegrationId,
      customerId,
    });

    return { url };
  },

  async completeConnect(
    organizationId: string,
    identifier: string,
    query: CallbackQuery
  ): Promise<{ integrations: SocialIntegration[], customerId?: string }> {
    if ('error' in query) {
      throw new HttpError(400, query.error_description || 'The connection was cancelled');
    }

    const provider = getProviderOrThrow(identifier);
    const state = await oauthStateStore.consume(query.state);
    if (
      !state ||
      state.organizationId !== organizationId ||
      state.providerIdentifier !== identifier
    ) {
      throw new HttpError(400, 'The connection link expired. Please try again.');
    }

    const org = await prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) throw new HttpError(404, 'Organization not found');

    const channelCount = await prisma.socialIntegration.count({
      where: { organizationId, deletedAt: null }
    });
    if (channelCount >= org.maxChannels) {
      throw new HttpError(403, `Plan limit reached: You can only connect up to ${org.maxChannels} channels. Upgrade your plan to connect more.`);
    }

    const authenticated = await provider.authenticate({
      code: query.code,
      codeVerifier: state.codeVerifier,
      redirectUri: getRedirectUri(identifier),
    });
    let accounts = Array.isArray(authenticated) ? authenticated : [authenticated];

    // Reconnecting renews only the channel it was started from.
    if (state.refreshIntegrationId) {
      const existing = await integrationRepository.findById(
        organizationId,
        state.refreshIntegrationId
      );
      if (!existing) {
        throw new HttpError(404, 'Channel not found');
      }
      accounts = accounts.filter((details) => details.internalId === existing.internalId);
      if (accounts.length === 0) {
        throw new HttpError(
          400,
          'You signed in with a different account. Reconnect using the original account.'
        );
      }
    }

    const integrations: SocialIntegration[] = [];
    for (const details of accounts) {
      integrations.push(
        await integrationRepository.upsert({
          organizationId,
          providerIdentifier: identifier,
          internalId: details.internalId,
          name: details.name,
          username: details.username ?? null,
          picture: details.picture ?? null,
          inBetweenSteps: provider.isBetweenSteps,
          customerId: state.customerId,
          ...toTokenFields(details),
        })
      );
    }
    
    // Log the connection event
    await logAudit({
      action: 'integration.connect',
      targetType: 'integration',
      targetId: integrations[0]?.id,
      metadata: { identifier, count: accounts.length }
    });
    
    return { integrations, customerId: state.customerId };
  },

  async setDisabled(organizationId: string, id: string, disabled: boolean): Promise<void> {
    const integration = await integrationRepository.findById(organizationId, id);
    if (!integration) {
      throw new HttpError(404, 'Channel not found');
    }
    await integrationRepository.setDisabled(integration.id, disabled);
    
    await logAudit({
      action: disabled ? 'integration.disable' : 'integration.enable',
      targetType: 'integration',
      targetId: integration.id,
      metadata: { disabled }
    });
  },

  // Soft delete only: posts that were already published keep their channel.
  async remove(organizationId: string, id: string): Promise<void> {
    const integration = await integrationRepository.findById(organizationId, id);
    if (!integration) {
      throw new HttpError(404, 'Channel not found');
    }
    await integrationRepository.softDelete(integration.id);
    await getIntegrationQueue().add(INTEGRATION_JOB.deleteData, { integrationId: integration.id });
    
    await logAudit({
      action: 'integration.remove',
      targetType: 'integration',
      targetId: integration.id,
    });
  },

  // Returns a usable access token, refreshing it first when it is about to expire.
  // If the refresh fails the channel is flagged so the user is asked to reconnect.
  async getAccessToken(integration: SocialIntegration): Promise<string> {
    const expiresSoon =
      integration.tokenExpiration !== null &&
      integration.tokenExpiration.getTime() - Date.now() < REFRESH_BUFFER_MS;

    if (!expiresSoon) {
      return decrypt(integration.accessToken);
    }
    return refreshAccessToken(integration);
  },

  // Background job: renews tokens before they expire so channels stay usable
  // even when nothing is scheduled for a while.
  async refreshExpiringTokens(): Promise<{ refreshed: number; failed: number }> {
    const integrations = await integrationRepository.findExpiring(
      new Date(Date.now() + TOKEN_REFRESH_WINDOW_MS)
    );

    let refreshed = 0;
    let failed = 0;
    for (const integration of integrations) {
      // Without a refresh token the current one keeps working until it expires.
      if (!integration.refreshToken && integration.tokenExpiration! > new Date()) {
        continue;
      }
      try {
        await refreshAccessToken(integration);
        refreshed += 1;
      } catch (error) {
        failed += 1;
        console.error(`[social] could not refresh the token of ${integration.id}`, error);
      }
    }
    return { refreshed, failed };
  },
};

async function refreshAccessToken(integration: SocialIntegration): Promise<string> {
  const provider = getProviderOrThrow(integration.providerIdentifier);

  if (!integration.refreshToken) {
    await integrationRepository.markRefreshNeeded(integration.id);
    throw new RefreshTokenError(provider.identifier, `${integration.name} must be reconnected`);
  }

  try {
    const details = await provider.refreshToken(decrypt(integration.refreshToken));
    await integrationRepository.updateTokens(integration.id, toTokenFields(details));
    return details.accessToken;
  } catch (error) {
    if (error instanceof ProviderError) {
      await integrationRepository.markRefreshNeeded(integration.id);
    }
    throw error;
  }
}
