import 'server-only';
import type { Prisma, SocialIntegration } from '@/generated/prisma/client';
import { decrypt, encrypt } from '@/shared/lib/crypto';
import { prisma } from '@/shared/lib/prisma';
import { getServerEnv } from '@/shared/lib/env';
import { HttpError } from '@/shared/server/http-error';
import { logAudit } from '@/shared/server/audit.service';
import type { ClientScope } from '@/shared/server/client-scope';
import type {
  AvailableProvider,
  ChannelItem,
  ChannelsResponse,
  ConnectUrlResponse,
  PendingPagesResponse,
} from '../../types/integration';
import { CHANNEL_MAPPING_SELECT, moveChannelRows } from '../customers/channel-mapping';
import { integrationRegistry } from './core/integration.registry';
import { ProviderError, RefreshTokenError } from './core/provider.errors';
import type { AuthTokenDetails, SocialProvider } from './core/social-provider.interface';
import { integrationRepository } from './integration.repository';
import type { CallbackQuery } from './integration.schema';
import { metaPagesPendingStore } from './meta-pages-pending';
import { oauthStateStore } from './oauth-state';
import { getIntegrationQueue, INTEGRATION_JOB } from './integration.queue';
import {
  trySubscribePageAfterConnect,
  tryUnsubscribePageBeforeDisconnect,
} from './providers/meta/meta-webhook-subscribe';
import { planService } from '../billing/plan.service';
import { clientTemplateService } from '../client-templates/client-template.service';
import { getAnalyticsQueue, ANALYTICS_JOB } from '../analytics/analytics.queue';

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
];

function isMetaPagesProvider(identifier: string): boolean {
  return identifier === 'facebook' || identifier === 'instagram';
}

type ConnectedAccountInput = {
  internalId: string;
  name: string;
  username: string | null;
  picture: string | null;
  metadata?: Record<string, unknown>;
  /** Plain Page token, only used to subscribe webhooks; never stored unencrypted. */
  accessTokenPlain: string;
  tokens: { accessToken: string; refreshToken: string | null; tokenExpiration: Date | null };
};

/**
 * Saves connected accounts. Client rule (R1/R5/R6): a channel that is already on a client keeps it —
 * moving it is done on the client page with a confirm. A new or Unassigned channel takes `customerId`
 * (the client picked in the switcher), or stays Unassigned when there is none.
 */
async function persistConnectedAccounts(
  organizationId: string,
  identifier: string,
  provider: SocialProvider,
  accounts: ConnectedAccountInput[],
  customerId: string | null
): Promise<SocialIntegration[]> {
  const existing = await prisma.socialIntegration.findMany({
    where: {
      organizationId,
      providerIdentifier: identifier,
      internalId: { in: accounts.map((account) => account.internalId) },
    },
    select: { ...CHANNEL_MAPPING_SELECT, deletedAt: true },
  });
  const existingByInternalId = new Map(existing.map((row) => [row.internalId, row]));

  const integrations: SocialIntegration[] = [];
  for (const details of accounts) {
    const before = existingByInternalId.get(details.internalId);
    const keepClient = before && !before.deletedAt && before.customerId ? before.customerId : null;
    const targetCustomerId = keepClient ?? customerId;
    const saved = await integrationRepository.upsert({
      organizationId,
      providerIdentifier: identifier,
      internalId: details.internalId,
      name: details.name,
      username: details.username,
      picture: details.picture,
      inBetweenSteps: provider.isBetweenSteps,
      customerId: targetCustomerId,
      additionalSettings: (details.metadata ?? []) as Prisma.InputJsonValue,
      ...details.tokens,
    });
    integrations.push(saved);

    // An Unassigned channel that now gets a client: its earlier rows follow it (R6).
    if (before && before.customerId === null && targetCustomerId) {
      await prisma.$transaction((tx) =>
        moveChannelRows(tx, organizationId, saved, null, targetCustomerId)
      );
    }

    // Page + Instagram webhooks: subscribe the Facebook Page so Meta delivers
    // feed/messages/leadgen to POST /api/webhooks/meta. Best-effort; never blocks connect.
    if (isMetaPagesProvider(identifier)) {
      const meta = details.metadata as { facebookPageId?: string } | undefined;
      const pageId = identifier === 'facebook' ? details.internalId : meta?.facebookPageId;
      void trySubscribePageAfterConnect(pageId, details.accessTokenPlain);

      // ~90-day media/insights backfill (analytics worker skips if already done).
      void getAnalyticsQueue()
        .add(
          ANALYTICS_JOB.backfill,
          { integrationId: saved.id },
          {
            jobId: `meta.backfill:${saved.id}`,
            removeOnComplete: true,
            removeOnFail: true,
          }
        )
        .catch((error) => {
          console.error('[social] enqueue analytics backfill failed', error);
        });
    }
  }

  await logAudit({
    action: 'integration.connect',
    targetType: 'integration',
    targetId: integrations[0]?.id,
    metadata: { identifier, count: accounts.length, customerId },
  });

  // Template bootstrap: posting schedule hints + set channel remapping.
  const forClient = customerId ? integrations.filter((row) => row.customerId === customerId) : [];
  if (customerId && forClient.length > 0) {
    try {
      await clientTemplateService.applyChannelBootstrap(
        organizationId,
        customerId,
        forClient.map((i) => ({
          id: i.id,
          providerIdentifier: i.providerIdentifier,
        }))
      );
    } catch (error) {
      console.error('[social] template channel bootstrap failed', error);
    }
  }

  return integrations;
}

export const integrationService = {
  async list(scope: ClientScope): Promise<ChannelsResponse> {
    const rows = await integrationRepository.list(scope);
    return {
      channels: rows.map(toChannelItem),
      providers: [...integrationRegistry.list().map(toAvailableProvider), ...EXTRA_CHANNEL_PROVIDERS],
    };
  },

  async getConnectUrl(
    organizationId: string,
    identifier: string,
    refreshIntegrationId?: string,
    customerId?: string,
    options: { fromPortal?: boolean } = {}
  ): Promise<ConnectUrlResponse> {
    const provider = getProviderOrThrow(identifier);
    await planService.assertChannelCapacity(organizationId);
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
      fromPortal: options.fromPortal || undefined,
    });

    return { url };
  },

  async completeConnect(
    organizationId: string,
    identifier: string,
    query: CallbackQuery
  ): Promise<{
    integrations: SocialIntegration[];
    customerId?: string;
    fromPortal?: boolean;
    pendingPages?: boolean;
  }> {
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

    // PS-01: Meta returns every Page the person manages. With more than one, hold them for 15 minutes
    // and let the admin tick the ones that belong here instead of importing all of them.
    if (
      isMetaPagesProvider(identifier) &&
      !state.refreshIntegrationId &&
      !state.fromPortal &&
      accounts.length > 1
    ) {
      await metaPagesPendingStore.save(organizationId, {
        organizationId,
        providerIdentifier: identifier,
        customerId: state.customerId ?? null,
        accounts: accounts.map((details) => {
          const tokens = toTokenFields(details);
          return {
            internalId: details.internalId,
            name: details.name,
            username: details.username ?? null,
            picture: details.picture ?? null,
            accessTokenEncrypted: tokens.accessToken,
            refreshTokenEncrypted: tokens.refreshToken,
            tokenExpiration: tokens.tokenExpiration?.toISOString() ?? null,
            metadata: details.metadata,
          };
        }),
      });
      return { integrations: [], customerId: state.customerId, fromPortal: false, pendingPages: true };
    }

    const integrations = await persistConnectedAccounts(
      organizationId,
      identifier,
      provider,
      accounts.map((details) => ({
        internalId: details.internalId,
        name: details.name,
        username: details.username ?? null,
        picture: details.picture ?? null,
        metadata: details.metadata,
        accessTokenPlain: details.accessToken,
        tokens: toTokenFields(details),
      })),
      state.customerId ?? null
    );

    return { integrations, customerId: state.customerId, fromPortal: state.fromPortal === true };
  },

  /** Page picker (PS-01): the Pages held after Meta OAuth, without tokens. */
  async listPendingPages(organizationId: string): Promise<PendingPagesResponse | null> {
    const pending = await metaPagesPendingStore.get(organizationId);
    if (!pending) return null;
    const existing = await prisma.socialIntegration.findMany({
      where: {
        organizationId,
        providerIdentifier: pending.providerIdentifier,
        internalId: { in: pending.accounts.map((account) => account.internalId) },
        deletedAt: null,
      },
      select: { internalId: true, customer: { select: { id: true, name: true } } },
    });
    const byInternalId = new Map(existing.map((row) => [row.internalId, row]));
    const client = pending.customerId
      ? await prisma.socialCustomer.findFirst({
          where: { id: pending.customerId, organizationId, deletedAt: null },
          select: { id: true, name: true },
        })
      : null;
    return {
      providerIdentifier: pending.providerIdentifier,
      client,
      pages: pending.accounts.map((account) => {
        const row = byInternalId.get(account.internalId);
        return {
          internalId: account.internalId,
          name: account.name,
          username: account.username,
          picture: account.picture,
          connected: Boolean(row),
          client: row?.customer ?? null,
        };
      }),
    };
  },

  /** Page picker (PS-01): save only the ticked Pages. Pages not ticked are never stored. */
  async savePendingPages(
    organizationId: string,
    body: { internalIds: string[]; customerId?: string | null }
  ): Promise<{ integrations: SocialIntegration[] }> {
    const pending = await metaPagesPendingStore.consume(organizationId);
    if (!pending || pending.organizationId !== organizationId) {
      throw new HttpError(400, 'The Page list expired. Connect again to pick Pages.');
    }
    const provider = getProviderOrThrow(pending.providerIdentifier);
    const wanted = new Set(body.internalIds);
    const picked = pending.accounts.filter((account) => wanted.has(account.internalId));
    if (picked.length === 0) {
      return { integrations: [] };
    }

    const customerId = body.customerId === undefined ? (pending.customerId ?? null) : body.customerId;
    if (customerId) {
      const client = await prisma.socialCustomer.findFirst({
        where: { id: customerId, organizationId, deletedAt: null },
        select: { id: true },
      });
      if (!client) throw new HttpError(404, 'Client not found');
    }

    const org = await prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) throw new HttpError(404, 'Organization not found');
    const already = await prisma.socialIntegration.findMany({
      where: {
        organizationId,
        providerIdentifier: pending.providerIdentifier,
        internalId: { in: picked.map((account) => account.internalId) },
        deletedAt: null,
      },
      select: { internalId: true },
    });
    const channelCount = await prisma.socialIntegration.count({
      where: { organizationId, deletedAt: null },
    });
    const adding = picked.length - already.length;
    if (channelCount + adding > org.maxChannels) {
      throw new HttpError(
        403,
        `Plan limit reached: ${adding} new channels would exceed ${org.maxChannels}. Pick fewer Pages or upgrade your plan.`
      );
    }

    const integrations = await persistConnectedAccounts(
      organizationId,
      pending.providerIdentifier,
      provider,
      picked.map((account) => ({
        internalId: account.internalId,
        name: account.name,
        username: account.username,
        picture: account.picture,
        metadata: account.metadata,
        accessTokenPlain: decrypt(account.accessTokenEncrypted),
        tokens: {
          accessToken: account.accessTokenEncrypted,
          refreshToken: account.refreshTokenEncrypted,
          tokenExpiration: account.tokenExpiration ? new Date(account.tokenExpiration) : null,
        },
      })),
      customerId
    );
    return { integrations };
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

    // Stop Meta webhook deliveries for this Page before the token is discarded.
    if (
      integration.providerIdentifier === 'facebook' ||
      integration.providerIdentifier === 'instagram'
    ) {
      try {
        const pageToken = decrypt(integration.accessToken);
        const settings = integration.additionalSettings as { facebookPageId?: string } | null;
        const pageId =
          integration.providerIdentifier === 'facebook'
            ? integration.internalId
            : (settings?.facebookPageId ?? null);
        await tryUnsubscribePageBeforeDisconnect(pageId, pageToken);
      } catch (error) {
        console.warn(
          `[meta] could not unsubscribe webhooks before disconnect for ${integration.id}:`,
          error instanceof Error ? error.message : error
        );
      }
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
