import 'server-only';
import { prisma } from '@/shared/lib/prisma';

interface WebhookData {
  name: string;
  url: string;
  integrationIds: string[];
}

const webhookInclude = {
  integrations: {
    where: { integration: { deletedAt: null } },
    select: { integrationId: true },
  },
} as const;

export const webhookRepository = {
  list(organizationId: string) {
    return prisma.socialWebhook.findMany({
      where: { organizationId, deletedAt: null },
      include: webhookInclude,
      orderBy: { createdAt: 'asc' },
    });
  },

  findById(organizationId: string, id: string) {
    return prisma.socialWebhook.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: webhookInclude,
    });
  },

  findActiveById(id: string) {
    return prisma.socialWebhook.findFirst({ where: { id, deletedAt: null } });
  },

  findForIntegration(integrationId: string) {
    return prisma.socialWebhook.findMany({
      where: { deletedAt: null, integrations: { some: { integrationId } } },
      select: { id: true },
    });
  },

  create(organizationId: string, { integrationIds, ...data }: WebhookData) {
    return prisma.socialWebhook.create({
      data: {
        organizationId,
        ...data,
        integrations: { create: integrationIds.map((integrationId) => ({ integrationId })) },
      },
      include: webhookInclude,
    });
  },

  // The channel links are replaced as a whole, like the post rows of an edited group.
  update(id: string, { integrationIds, ...data }: WebhookData) {
    return prisma.socialWebhook.update({
      where: { id },
      data: {
        ...data,
        integrations: {
          deleteMany: {},
          create: integrationIds.map((integrationId) => ({ integrationId })),
        },
      },
      include: webhookInclude,
    });
  },

  findPublishedPost(postId: string) {
    return prisma.socialPost.findFirst({
      where: { id: postId, state: 'PUBLISHED', deletedAt: null },
      include: {
        integration: { select: { id: true, name: true, providerIdentifier: true } },
      },
    });
  },

  softDelete(id: string) {
    return prisma.socialWebhook.update({ where: { id }, data: { deletedAt: new Date() } });
  },
};
