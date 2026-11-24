import 'server-only';
import type { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/shared/lib/prisma';
import { customerIdFilter, type ScopeCustomerIds } from '@/shared/server/client-scope';
import { PUBLISHED_POST_TYPE_VALUES } from '../../config/published-posts';

// Only the first post of each channel counts; thread comments are part of the same post.
function rootPostsWhere(organizationId: string, clientIds: ScopeCustomerIds = 'all'): Prisma.SocialPostWhereInput {
  return {
    organizationId,
    deletedAt: null,
    parentPostId: null,
    integration: {
      deletedAt: null,
      customerId: customerIdFilter(clientIds)
    },
  };
}

export const analyticsRepository = {
  listOutcomes(organizationId: string, start: Date, end: Date, clientIds: ScopeCustomerIds = 'all') {
    return prisma.socialPost.findMany({
      where: {
        ...rootPostsWhere(organizationId, clientIds),
        state: { in: ['PUBLISHED', 'ERROR'] },
        publishDate: { gte: start, lt: end },
      },
      select: { integrationId: true, state: true, publishDate: true },
      orderBy: { publishDate: 'asc' },
    });
  },

  countUpcoming(organizationId: string, from: Date, clientIds: ScopeCustomerIds = 'all'): Promise<number> {
    return prisma.socialPost.count({
      where: { ...rootPostsWhere(organizationId, clientIds), state: 'QUEUE', publishDate: { gte: from } },
    });
  },

  countDrafts(organizationId: string, clientIds: ScopeCustomerIds = 'all'): Promise<number> {
    return prisma.socialPost.count({
      where: { ...rootPostsWhere(organizationId, clientIds), state: 'DRAFT' },
    });
  },

  listChannels(organizationId: string, clientIds: ScopeCustomerIds = 'all') {
    return prisma.socialIntegration.findMany({
      where: {
        organizationId,
        deletedAt: null,
        customerId: customerIdFilter(clientIds)
      },
      select: {
        id: true,
        name: true,
        picture: true,
        providerIdentifier: true,
        internalId: true,
        accessToken: true,
      },
      orderBy: { name: 'asc' },
    });
  },

  listPublishedPosts(organizationId: string, start: Date, end: Date, clientIds: ScopeCustomerIds = 'all') {
    return prisma.socialPost.findMany({
      where: {
        ...rootPostsWhere(organizationId, clientIds),
        state: 'PUBLISHED',
        publishDate: { gte: start, lt: end },
      },
      select: {
        id: true,
        content: true,
        media: true,
        publishDate: true,
        releaseId: true,
        releaseUrl: true,
        integration: {
          select: {
            id: true,
            name: true,
            picture: true,
            providerIdentifier: true,
            accessToken: true,
          },
        },
      },
      orderBy: { publishDate: 'desc' },
    });
  },
  async listExternalPosts(organizationId: string, start: Date, end: Date, clientIds: ScopeCustomerIds = 'all') {
    const validIntegrations = await prisma.socialIntegration.findMany({
      where: {
        organizationId,
        deletedAt: null,
        customerId: customerIdFilter(clientIds)
      },
      select: { id: true }
    });
    const validIntegrationIds = validIntegrations.map((i: any) => i.id);

    return prisma.socialExternalPost.findMany({
      where: {
        integrationId: { in: validIntegrationIds },
        publishedAt: { gte: start, lt: end },
        // PS-10: "Posts published" counts feed posts, reels, videos and carousels only (no stories/replies).
        type: { in: PUBLISHED_POST_TYPE_VALUES },
      },
      select: {
        externalId: true,
        caption: true,
        permalink: true,
        thumbnailUrl: true,
        publishedAt: true,
        likes: true,
        comments: true,
        shares: true,
        reach: true,
        impressions: true,
        engagementRate: true,
        engagement: true,
        clicks: true,
        saves: true,
        videoViews: true,
        integrationId: true,
      },
      orderBy: { publishedAt: 'desc' },
    });
  },

  findScopedIntegration(
    organizationId: string,
    integrationId: string,
    clientIds: ScopeCustomerIds = 'all'
  ) {
    return prisma.socialIntegration.findFirst({
      where: {
        id: integrationId,
        organizationId,
        deletedAt: null,
        customerId: customerIdFilter(clientIds),
      },
      select: { id: true, name: true, providerIdentifier: true },
    });
  },

  listExternalPostsForBestTimes(integrationId: string, since: Date) {
    return prisma.socialExternalPost.findMany({
      where: {
        integrationId,
        publishedAt: { gte: since },
      },
      select: {
        publishedAt: true,
        likes: true,
        comments: true,
        reach: true,
      },
    });
  },
};
