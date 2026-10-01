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

interface FacebookPostFields {
  likes?: { summary?: { total_count?: number } };
  comments?: { summary?: { total_count?: number } };
  reactions?: { summary?: { total_count?: number } };
  shares?: { count?: number };
}

interface InstagramMediaFields {
  like_count?: number;
  comments_count?: number;
  insights?: GraphList<{ name: string; values?: { value: number }[] }>;
}

interface FacebookInsightRow {
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
    if (!(error instanceof GraphApiError)) throw error;
  }

  try {
    const insights = await graphGet<GraphList<FacebookInsightRow>>(
      config,
      `${releaseId}/insights`,
      token,
      {
        metric: [
          'post_impressions',
          'post_impressions_unique',
          'post_engaged_users',
          'post_clicks',
          'post_video_views',
        ].join(','),
      }
    );
    metrics.impressions = insightValue(insights.data, 'post_impressions');
    metrics.reach = insightValue(insights.data, 'post_impressions_unique');
    metrics.engagement = insightValue(insights.data, 'post_engaged_users');
    metrics.clicks = insightValue(insights.data, 'post_clicks');
    metrics.views = insightValue(insights.data, 'post_video_views');
  } catch {
    // Insights need read_insights; counts above may still be present.
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
      fields: 'like_count,comments_count',
    });
    metrics.likes = num(media.like_count);
    metrics.comments = num(media.comments_count);
  } catch (error) {
    if (!(error instanceof GraphApiError)) throw error;
  }

  // Try common lifetime metrics; some only apply to certain media types.
  for (const metricSet of [
    'impressions,reach,saved,shares,total_interactions,views,video_views',
    'reach,saved,shares,total_interactions,views',
    'impressions,reach,engagement,saved',
  ]) {
    try {
      const insights = await graphGet<GraphList<{ name: string; values?: { value: number }[] }>>(
        config,
        `${releaseId}/insights`,
        token,
        { metric: metricSet }
      );
      metrics.impressions = metrics.impressions ?? insightValue(insights.data, 'impressions');
      metrics.reach = metrics.reach ?? insightValue(insights.data, 'reach');
      metrics.saved = metrics.saved ?? insightValue(insights.data, 'saved');
      metrics.shares = metrics.shares ?? insightValue(insights.data, 'shares');
      metrics.engagement =
        metrics.engagement ??
        insightValue(insights.data, 'total_interactions') ??
        insightValue(insights.data, 'engagement');
      metrics.views =
        metrics.views ??
        insightValue(insights.data, 'views') ??
        insightValue(insights.data, 'video_views');
      break;
    } catch {
      // Try the next metric set.
    }
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

  try {
    const token = decrypt(encryptedAccessToken);
    if (providerIdentifier === 'facebook') {
      return await facebookMetrics(releaseId, token);
    }
    return await instagramMetrics(releaseId, token);
  } catch {
    return { metrics: emptyMetrics(), unavailable: true };
  }
}
