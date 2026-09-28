import 'server-only';
import type { SocialIntegration } from '@/generated/prisma/client';
import { prisma } from '@/shared/lib/prisma';

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
}

export interface UpdateTokensData {
  accessToken: string;
  refreshToken: string | null;
  tokenExpiration: Date | null;
}

export const integrationRepository = {
  list(organizationId: string) {
    return prisma.socialIntegration.findMany({
      where: { organizationId, deletedAt: null },
      include: { customer: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'asc' },
    });
  },

  findById(organizationId: string, id: string): Promise<SocialIntegration | null> {
    return prisma.socialIntegration.findFirst({ where: { id, organizationId, deletedAt: null } });
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

  markRefreshNeeded(id: string): Promise<SocialIntegration> {
    return prisma.socialIntegration.update({ where: { id }, data: { refreshNeeded: true } });
  },

  softDelete(id: string): Promise<SocialIntegration> {
    return prisma.socialIntegration.update({ where: { id }, data: { deletedAt: new Date() } });
  },
};
