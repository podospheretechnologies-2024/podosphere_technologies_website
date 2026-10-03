import 'server-only';
import { decrypt } from '@/shared/lib/crypto';
import { getServerEnv } from '@/shared/lib/env';
import type { AnalyticsPostMetrics } from '../../types/analytics';
import {
  GraphApiError,
  graphGet,
  type GraphConfig,
  type GraphList,
} from '../integrations/providers/meta/graph-client';

export interface MetaHistoryPost {
  releaseId: string;
  content: string;
  publishDate: Date;
  releaseUrl: string | null;
  thumbnailUrl: string | null;
  providerIdentifier: 'facebook' | 'instagram';
  seedMetrics: AnalyticsPostMetrics;
}

type GraphPagedList<T> = GraphList<T> & {
  paging?: { cursors?: { after?: string }; next?: string };
};

interface FacebookPagePost {
  id: string;
  message?: string;
  story?: string;
  created_time?: string;
  permalink_url?: string;
  full_picture?: string;
  shares?: { count?: number };
  likes?: { summary?: { total_count?: number } };
  comments?: { summary?: { total_count?: number } };
  reactions?: { summary?: { total_count?: number } };
}

interface InstagramMediaItem {
  id: string;
  caption?: string;
  timestamp?: string;
  permalink?: string;
  media_url?: string;
  thumbnail_url?: string;
  like_count?: number;
  comments_count?: number;
  media_type?: string;
}

const PAGE_SIZE = 25;
const MAX_PAGES_PER_CHANNEL = 8;

function graphConfig(): GraphConfig {
  const env = getServerEnv();
  return { version: env.META_GRAPH_VERSION, appSecret: env.META_APP_SECRET || undefined };
}

function emptyMetrics(): AnalyticsPostMetrics {
  return {
    likes: null,
    views: null,
    comments: null,
    shares: null,
    reach: null,
    impressions: null,
    engagement: null,
    saved: null,
    clicks: null,
  };
}

function num(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function getPaged<T>(
  path: string,
  token: string,
  params: Record<string, string | number>,
  maxPages: number
): Promise<T[]> {
  const config = graphConfig();
  const items: T[] = [];
  let after: string | undefined;

  for (let page = 0; page < maxPages; page += 1) {
    const result = await graphGet<GraphPagedList<T>>(config, path, token, {
      ...params,
      limit: PAGE_SIZE,
      ...(after ? { after } : {}),
    });
    items.push(...(result.data ?? []));
    after = result.paging?.cursors?.after;
    if (!after || !(result.data?.length)) break;
  }

  return items;
}

function inRange(date: Date, start: Date, end: Date): boolean {
  return date >= start && date < end;
}

async function fetchFacebookHistory(
  pageId: string,
  token: string,
  start: Date,
  end: Date
): Promise<MetaHistoryPost[]> {
  const since = Math.floor(start.getTime() / 1000);
  const until = Math.floor(end.getTime() / 1000);

  // published_posts = posts created by the Page (includes history before this app).
  const rows = await getPaged<FacebookPagePost>(
    `${pageId}/published_posts`,
    token,
    {
      fields:
        'id,message,story,created_time,permalink_url,full_picture,shares,likes.summary(true).limit(0),comments.summary(true).limit(0),reactions.summary(true).limit(0)',
      since,
      until,
    },
    MAX_PAGES_PER_CHANNEL
  ).catch(async () => {
    // Fallback for pages where published_posts is restricted.
    return getPaged<FacebookPagePost>(
      `${pageId}/posts`,
      token,
      {
        fields:
          'id,message,story,created_time,permalink_url,full_picture,shares,likes.summary(true).limit(0),comments.summary(true).limit(0),reactions.summary(true).limit(0)',
        since,
        until,
      },
      MAX_PAGES_PER_CHANNEL
    );
  });

  return rows
    .map((row) => {
      const publishDate = row.created_time ? new Date(row.created_time) : null;
      if (!publishDate || Number.isNaN(publishDate.getTime()) || !inRange(publishDate, start, end)) {
        return null;
      }
      const metrics = emptyMetrics();
      metrics.likes = num(row.reactions?.summary?.total_count ?? row.likes?.summary?.total_count);
      metrics.comments = num(row.comments?.summary?.total_count);
      metrics.shares = num(row.shares?.count);
      return {
        releaseId: row.id,
        content: (row.message ?? row.story ?? '').trim(),
        publishDate,
        releaseUrl: row.permalink_url ?? null,
        thumbnailUrl: row.full_picture ?? null,
        providerIdentifier: 'facebook' as const,
        seedMetrics: metrics,
      };
    })
    .filter((row): row is MetaHistoryPost => row !== null);
}

async function fetchInstagramHistory(
  igUserId: string,
  token: string,
  start: Date,
  end: Date
): Promise<MetaHistoryPost[]> {
  // /media has no since/until on all API versions — page newest-first and stop past start.
  const config = graphConfig();
  const collected: InstagramMediaItem[] = [];
  let after: string | undefined;

  for (let page = 0; page < MAX_PAGES_PER_CHANNEL; page += 1) {
    const result = await graphGet<GraphPagedList<InstagramMediaItem>>(
      config,
      `${igUserId}/media`,
      token,
      {
        fields:
          'id,caption,timestamp,permalink,media_url,thumbnail_url,like_count,comments_count,media_type',
        limit: PAGE_SIZE,
        ...(after ? { after } : {}),
      }
    );
    const batch = result.data ?? [];
    if (batch.length === 0) break;

    let reachedBeforeStart = false;
    for (const item of batch) {
      const publishDate = item.timestamp ? new Date(item.timestamp) : null;
      if (!publishDate || Number.isNaN(publishDate.getTime())) continue;
      if (publishDate >= end) continue;
      if (publishDate < start) {
        reachedBeforeStart = true;
        continue;
      }
      collected.push(item);
    }

    after = result.paging?.cursors?.after;
    if (!after || reachedBeforeStart) break;
  }

  return collected.map((item) => {
    const publishDate = new Date(item.timestamp as string);
    const metrics = emptyMetrics();
    metrics.likes = num(item.like_count);
    metrics.comments = num(item.comments_count);
    return {
      releaseId: item.id,
      content: (item.caption ?? '').trim(),
      publishDate,
      releaseUrl: item.permalink ?? null,
      thumbnailUrl: item.thumbnail_url ?? item.media_url ?? null,
      providerIdentifier: 'instagram' as const,
      seedMetrics: metrics,
    };
  });
}

export async function fetchMetaHistoryForChannel(
  channel: {
    providerIdentifier: string;
    internalId: string;
    accessToken: string;
  },
  start: Date,
  end: Date
): Promise<MetaHistoryPost[]> {
  if (channel.providerIdentifier !== 'facebook' && channel.providerIdentifier !== 'instagram') {
    return [];
  }

  try {
    const token = decrypt(channel.accessToken);
    if (channel.providerIdentifier === 'facebook') {
      return await fetchFacebookHistory(channel.internalId, token, start, end);
    }
    return await fetchInstagramHistory(channel.internalId, token, start, end);
  } catch (error) {
    if (error instanceof GraphApiError) {
      return [];
    }
    return [];
  }
}
