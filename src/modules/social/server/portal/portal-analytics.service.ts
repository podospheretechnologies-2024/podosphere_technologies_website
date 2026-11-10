import 'server-only';
import { prisma } from '@/shared/lib/prisma';
import type { PortalSession } from '../approvals/approval.service';

export type PortalAnalyticsChannel = {
  name: string;
  picture: string | null;
  provider: string;
  followers: number | null;
  reach30: number;
  impressions30: number;
  posts30: number;
};

export type PortalAnalyticsBestPost = {
  id: string;
  channelName: string;
  caption: string | null;
  permalink: string | null;
  thumbnailUrl: string | null;
  publishedAt: string;
  likes: number;
  comments: number;
  reach: number | null;
  engagementRate: number | null;
};

export type PortalAnalyticsDto = {
  since: string;
  until: string;
  channels: PortalAnalyticsChannel[];
  bestPosts: PortalAnalyticsBestPost[];
};

export const portalAnalyticsService = {
  async get(
    session: Pick<PortalSession, 'organizationId' | 'customerId'>,
    days = 30
  ): Promise<PortalAnalyticsDto> {
    const until = new Date();
    const since = new Date();
    since.setDate(since.getDate() - days);
    since.setHours(0, 0, 0, 0);

    const integrations = await prisma.socialIntegration.findMany({
      where: {
        organizationId: session.organizationId,
        customerId: session.customerId,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        picture: true,
        providerIdentifier: true,
      },
      orderBy: { name: 'asc' },
    });

    const integrationIds = integrations.map((row) => row.id);
    if (integrationIds.length === 0) {
      return {
        since: since.toISOString().slice(0, 10),
        until: until.toISOString().slice(0, 10),
        channels: [],
        bestPosts: [],
      };
    }

    const [followers, insights, posts30, bestRaw] = await Promise.all([
      prisma.socialInsightDaily.findMany({
        where: { integrationId: { in: integrationIds }, metric: 'followers' },
        orderBy: { date: 'desc' },
        distinct: ['integrationId'],
        select: { integrationId: true, value: true },
      }),
      prisma.socialInsightDaily.findMany({
        where: {
          integrationId: { in: integrationIds },
          date: { gte: since },
          metric: { in: ['reach', 'impressions'] },
        },
        select: { integrationId: true, metric: true, value: true },
      }),
      prisma.socialExternalPost.groupBy({
        by: ['integrationId'],
        where: {
          integrationId: { in: integrationIds },
          publishedAt: { gte: since },
        },
        _count: { _all: true },
      }),
      prisma.socialExternalPost.findMany({
        where: {
          integrationId: { in: integrationIds },
          publishedAt: { gte: since },
        },
        orderBy: [{ likes: 'desc' }, { publishedAt: 'desc' }],
        take: 8,
        select: {
          id: true,
          integrationId: true,
          caption: true,
          permalink: true,
          thumbnailUrl: true,
          publishedAt: true,
          likes: true,
          comments: true,
          reach: true,
          engagementRate: true,
        },
      }),
    ]);

    const followersById = new Map(followers.map((row) => [row.integrationId, Number(row.value)]));
    const postsById = new Map(posts30.map((row) => [row.integrationId, row._count._all]));
    const reachById = new Map<string, number>();
    const impressionsById = new Map<string, number>();
    for (const row of insights) {
      const map = row.metric === 'reach' ? reachById : impressionsById;
      map.set(row.integrationId, (map.get(row.integrationId) ?? 0) + Number(row.value));
    }

    const channelById = new Map(integrations.map((row) => [row.id, row]));
    const channels: PortalAnalyticsChannel[] = integrations.map((row) => ({
      name: row.name,
      picture: row.picture,
      provider: row.providerIdentifier,
      followers: followersById.get(row.id) ?? null,
      reach30: reachById.get(row.id) ?? 0,
      impressions30: impressionsById.get(row.id) ?? 0,
      posts30: postsById.get(row.id) ?? 0,
    }));

    const bestPosts: PortalAnalyticsBestPost[] = bestRaw.map((post) => ({
      id: post.id,
      channelName: channelById.get(post.integrationId)?.name ?? 'Channel',
      caption: post.caption,
      permalink: post.permalink,
      thumbnailUrl: post.thumbnailUrl,
      publishedAt: post.publishedAt.toISOString(),
      likes: post.likes ?? 0,
      comments: post.comments ?? 0,
      reach: post.reach,
      engagementRate: post.engagementRate != null ? Number(post.engagementRate) : null,
    }));

    return {
      since: since.toISOString().slice(0, 10),
      until: until.toISOString().slice(0, 10),
      channels,
      bestPosts,
    };
  },
};
