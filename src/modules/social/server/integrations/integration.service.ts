import 'server-only';
import type { SocialIntegration } from '@/generated/prisma/client';
import { decrypt, encrypt } from '@/shared/lib/crypto';
import { getServerEnv } from '@/shared/lib/env';
import { HttpError } from '@/shared/server/http-error';
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

// Refresh tokens this long before they expire so a scheduled post never uses a stale one.
const REFRESH_BUFFER_MS = 10 * 60 * 1000;

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
  };
}

export const integrationService = {
  async list(organizationId: string): Promise<ChannelsResponse> {
    const rows = await integrationRepository.list(organizationId);
    return {
      channels: rows.map(toChannelItem),
      providers: integrationRegistry.list().map(toAvailableProvider),
    };
  },

  async getConnectUrl(
    organizationId: string,
    identifier: string,
    refreshIntegrationId?: string
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
    });

    return { url };
  },

  async completeConnect(
    organizationId: string,
    identifier: string,
    query: CallbackQuery
  ): Promise<SocialIntegration> {
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

    const details = await provider.authenticate({
      code: query.code,
      codeVerifier: state.codeVerifier,
      redirectUri: getRedirectUri(identifier),
    });

    if (state.refreshIntegrationId) {
      const existing = await integrationRepository.findById(
        organizationId,
        state.refreshIntegrationId
      );
      if (!existing) {
        throw new HttpError(404, 'Channel not found');
      }
      if (existing.internalId !== details.internalId) {
        throw new HttpError(
          400,
          'You signed in with a different account. Reconnect using the original account.'
        );
      }
    }

    return integrationRepository.upsert({
      organizationId,
      providerIdentifier: identifier,
      internalId: details.internalId,
      name: details.name,
      username: details.username ?? null,
      picture: details.picture ?? null,
      inBetweenSteps: provider.isBetweenSteps,
      ...toTokenFields(details),
    });
  },

  async setDisabled(organizationId: string, id: string, disabled: boolean): Promise<void> {
    const integration = await integrationRepository.findById(organizationId, id);
    if (!integration) {
      throw new HttpError(404, 'Channel not found');
    }
    await integrationRepository.setDisabled(integration.id, disabled);
  },

  // Soft delete only: posts that were already published keep their channel.
  async remove(organizationId: string, id: string): Promise<void> {
    const integration = await integrationRepository.findById(organizationId, id);
    if (!integration) {
      throw new HttpError(404, 'Channel not found');
    }
    await integrationRepository.softDelete(integration.id);
  },

  // Returns a usable access token, refreshing it first when it is about to expire.
  // If the refresh fails the channel is flagged so the user is asked to reconnect.
  async getAccessToken(integration: SocialIntegration): Promise<string> {
    const provider = getProviderOrThrow(integration.providerIdentifier);
    const expiresSoon =
      integration.tokenExpiration !== null &&
      integration.tokenExpiration.getTime() - Date.now() < REFRESH_BUFFER_MS;

    if (!expiresSoon) {
      return decrypt(integration.accessToken);
    }

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
  },
};
