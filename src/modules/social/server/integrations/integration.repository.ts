import 'server-only';
import type { SocialIntegration } from '@/generated/prisma/client';
import { prisma } from '@/shared/lib/prisma';
import { scopeWhere, type ClientScope } from '@/shared/server/client-scope';

export interface UpsertIntegrationData {
  organizationId: string;
  providerIdentifier: string;
  internalId: string;
  name: string;
  username: string | null;
  picture: string | null;
  accessToken: string;
  refreshToken: string | null;
  tokenExpiration: Date | null;
  inBetweenSteps: boolean;
  customerId?: string | null;
  additionalSettings?: any;
}

export interface UpdateTokensData {
  accessToken: string;
  refreshToken: string | null;
  tokenExpiration: Date | null;
}

export const integrationRepository = {
  async list(scope: ClientScope) {
    return prisma.socialIntegration.findMany({
      where: { ...scopeWhere(scope), deletedAt: null },
      include: { customer: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'asc' },
    });
  },

  findById(organizationId: string, id: string): Promise<SocialIntegration | null> {
    return prisma.socialIntegration.findFirst({ where: { id, organizationId, deletedAt: null } });
  },

  findManyByIds(organizationId: string, ids: string[]): Promise<SocialIntegration[]> {
    return prisma.socialIntegration.findMany({
      where: { id: { in: ids }, organizationId, deletedAt: null },
    });
  },

  // Active channels whose token expires before `before`; channels that already
  // wait for a reconnect are skipped.
  findExpiring(before: Date): Promise<SocialIntegration[]> {
    return prisma.socialIntegration.findMany({
      where: {
        deletedAt: null,
        disabled: false,
        refreshNeeded: false,
        tokenExpiration: { not: null, lt: before },
      },
    });
  },

  // Reconnecting an account (even a previously deleted one) reuses the same row,
  // so existing posts keep pointing at it.
  upsert(data: UpsertIntegrationData): Promise<SocialIntegration> {
    const { organizationId, providerIdentifier, internalId, ...fields } = data;
    const reset = { ...fields, disabled: false, refreshNeeded: false, deletedAt: null };

    return prisma.socialIntegration.upsert({
      where: {
        organizationId_providerIdentifier_internalId: {
          organizationId,
          providerIdentifier,
          internalId,
        },
      },
      create: { organizationId, providerIdentifier, internalId, ...fields },
      update: reset,
    });
  },

  updateTokens(id: string, data: UpdateTokensData): Promise<SocialIntegration> {
    return prisma.socialIntegration.update({
      where: { id },
      data: { ...data, refreshNeeded: false },
    });
  },

  setDisabled(id: string, disabled: boolean): Promise<SocialIntegration> {
    return prisma.socialIntegration.update({ where: { id }, data: { disabled } });
  },

  /**
   * Marks refreshNeeded. On false → true, fires a one-shot token_expired notification
   * (deduped + soft-fail email inside notificationService).
   */
  async markRefreshNeeded(id: string): Promise<SocialIntegration> {
    const result = await prisma.socialIntegration.updateMany({
      where: { id, refreshNeeded: false },
      data: { refreshNeeded: true },
    });
    const integration = await prisma.socialIntegration.findUniqueOrThrow({ where: { id } });
    if (result.count > 0) {
      const { notificationService } = await import('../notifications/notification.service');
      void notificationService
        .tokenExpired(integration.organizationId, integration.name)
        .catch((err) => console.error('[integrations] token_expired notify failed', err));
    }
    return integration;
  },

  softDelete(id: string): Promise<SocialIntegration> {
    return prisma.socialIntegration.update({ where: { id }, data: { deletedAt: new Date() } });
  },
};
