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

const emptyMetrics = (): AnalyticsPostMetrics => ({
  likes: null,
  views: null,
  comments: null,
  shares: null,
  reach: null,
  impressions: null,
  engagement: null,
  saved: null,
  clicks: null,
});

function graphConfig(): GraphConfig {
  const env = getServerEnv();
  return { version: env.META_GRAPH_VERSION, appSecret: env.META_APP_SECRET || undefined };
}

function num(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function insightValue(
  rows: { name: string; values?: { value: number | Record<string, number> }[] }[] | undefined,
  name: string
): number | null {
  const row = rows?.find((entry) => entry.name === name);
  const value = row?.values?.[0]?.value;
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object') {
    return Object.values(value).reduce((sum, entry) => sum + (Number(entry) || 0), 0);
  }
  return null;
}

function firstInsight(
  rows: { name: string; values?: { value: number | Record<string, number> }[] }[] | undefined,
  names: string[]
): number | null {
  for (const name of names) {
    const value = insightValue(rows, name);
    if (value !== null) return value;
  }
  return null;
}

interface FacebookPostFields {
  likes?: { summary?: { total_count?: number } };
  comments?: { summary?: { total_count?: number } };
  reactions?: { summary?: { total_count?: number } };
  shares?: { count?: number };
}

interface InstagramMediaFields {
  like_count?: number;
  comments_count?: number;
  media_type?: string;
  media_product_type?: string;
}

interface InsightRow {
  name: string;
  values?: { value: number | Record<string, number> }[];
}

async function facebookMetrics(
  releaseId: string,
  token: string
): Promise<{ metrics: AnalyticsPostMetrics; unavailable: boolean }> {
  const config = graphConfig();
  const metrics = emptyMetrics();

  try {
    const post = await graphGet<FacebookPostFields>(config, releaseId, token, {
      fields:
        'likes.summary(true).limit(0),comments.summary(true).limit(0),reactions.summary(true).limit(0),shares',
    });
    metrics.likes = num(post.reactions?.summary?.total_count ?? post.likes?.summary?.total_count);
    metrics.comments = num(post.comments?.summary?.total_count);
    metrics.shares = num(post.shares?.count);
  } catch (error) {
    if (error instanceof GraphApiError && (error.isAuthError || error.isRateLimitError)) throw error;
    if (!(error instanceof GraphApiError)) throw error;
  }

  // Graph v26: post_impressions* / post_engaged_users / post_video_views are deprecated above v25
  // (one bad metric fails the whole call), so each current metric is requested on its own.
  const fetchOne = async (metric: string): Promise<InsightRow[] | undefined> => {
    try {
      const res = await graphGet<GraphList<InsightRow>>(config, `${releaseId}/insights`, token, {
        metric,
      });
      return res.data;
    } catch (error) {
      if (error instanceof GraphApiError && (error.isAuthError || error.isRateLimitError)) throw error;
      console.warn(
        `[post-metrics] facebook insight ${metric} failed for ${releaseId}:`,
        error instanceof Error ? error.message : error
      );
      return undefined;
    }
  };

  const mediaView = await fetchOne('post_media_view');
  const mediaViewUnique = await fetchOne('post_total_media_view_unique');
  const clicksByType = await fetchOne('post_clicks_by_type');
  metrics.views = insightValue(mediaView, 'post_media_view');
  metrics.impressions = metrics.views;
  metrics.reach = insightValue(mediaViewUnique, 'post_total_media_view_unique');
  metrics.clicks = insightValue(clicksByType, 'post_clicks_by_type');
  const interactions = [metrics.likes, metrics.comments, metrics.shares].filter(
    (value): value is number => value !== null
  );
  if (interactions.length > 0) {
    metrics.engagement = interactions.reduce((sum, value) => sum + value, 0);
  }

  const hasAny = Object.values(metrics).some((value) => value !== null);
  return { metrics, unavailable: !hasAny };
}

async function instagramMetrics(
  releaseId: string,
  token: string
): Promise<{ metrics: AnalyticsPostMetrics; unavailable: boolean }> {
  const config = graphConfig();
  const metrics = emptyMetrics();

  try {
    const media = await graphGet<InstagramMediaFields>(config, releaseId, token, {
      fields: 'like_count,comments_count,media_type,media_product_type',
    });
    metrics.likes = num(media.like_count);
    metrics.comments = num(media.comments_count);
  } catch (error) {
    if (error instanceof GraphApiError && (error.isAuthError || error.isRateLimitError)) throw error;
    if (!(error instanceof GraphApiError)) throw error;
  }

  // Meta rotates IG insight metric names; try a short list (avoid serial Graph storms).
  const metricSets = [
    'reach,saved,shares,total_interactions,views,likes,comments',
    'reach,saved,shares,total_interactions,views',
    'impressions,reach,engagement,saved',
  ];

  for (const metricSet of metricSets) {
    try {
      const insights = await graphGet<GraphList<InsightRow>>(
        config,
        `${releaseId}/insights`,
        token,
        { metric: metricSet, period: 'lifetime' }
      );
      metrics.impressions =
        metrics.impressions ?? firstInsight(insights.data, ['impressions', 'views']);
      metrics.reach = metrics.reach ?? insightValue(insights.data, 'reach');
      metrics.saved = metrics.saved ?? insightValue(insights.data, 'saved');
      metrics.shares = metrics.shares ?? insightValue(insights.data, 'shares');
      metrics.likes = metrics.likes ?? insightValue(insights.data, 'likes');
      metrics.comments = metrics.comments ?? insightValue(insights.data, 'comments');
      metrics.engagement =
        metrics.engagement ??
        firstInsight(insights.data, ['total_interactions', 'engagement']);
      metrics.views =
        metrics.views ?? firstInsight(insights.data, ['views', 'video_views', 'plays']);
      if (metrics.reach !== null || metrics.impressions !== null || metrics.views !== null) {
        break;
      }
    } catch (error) {
      if (error instanceof GraphApiError && (error.isAuthError || error.isRateLimitError)) throw error;
      // Try the next metric set.
    }
  }

  if (metrics.impressions === null && metrics.views !== null) {
    metrics.impressions = metrics.views;
  }

  const hasAny = Object.values(metrics).some((value) => value !== null);
  return { metrics, unavailable: !hasAny };
}

export async function fetchPostMetrics(
  providerIdentifier: string,
  releaseId: string | null,
  encryptedAccessToken: string
): Promise<{ metrics: AnalyticsPostMetrics; unavailable: boolean }> {
  if (!releaseId) {
    return { metrics: emptyMetrics(), unavailable: true };
  }

  if (providerIdentifier !== 'facebook' && providerIdentifier !== 'instagram') {
    return { metrics: emptyMetrics(), unavailable: true };
  }

  const fallback = { metrics: emptyMetrics(), unavailable: true };

  try {
    const token = decrypt(encryptedAccessToken);
    const fetchMetrics =
      providerIdentifier === 'facebook'
        ? facebookMetrics(releaseId, token)
        : instagramMetrics(releaseId, token);

    return await Promise.race([
      fetchMetrics,
      new Promise<typeof fallback>((resolve) => {
        setTimeout(() => resolve(fallback), 6_000);
      }),
    ]);
  } catch (error) {
    if (error instanceof GraphApiError && (error.isAuthError || error.isRateLimitError)) throw error;
    return fallback;
  }
}
