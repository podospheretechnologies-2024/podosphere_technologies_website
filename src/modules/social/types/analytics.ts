export type AnalyticsOutcome = 'published' | 'error';

export interface AnalyticsTotals {
  published: number;
  failed: number;
  /** Upcoming queued posts, independent of the selected range. */
  scheduled: number;
  drafts: number;
}

export interface AnalyticsPostMetrics {
  likes: number | null;
  views: number | null;
  comments: number | null;
  shares: number | null;
  reach: number | null;
  impressions: number | null;
  engagement: number | null;
  saved: number | null;
  clicks: number | null;
}

export interface AnalyticsChannel {
  id: string;
  name: string;
  picture: string | null;
  providerIdentifier: string;
  providerName: string;
  published: number;
  failed: number;
  /** Summed Meta engagement metrics for published posts in the range. */
  metrics: AnalyticsPostMetrics;
}

export interface AnalyticsActivity {
  date: string;
  outcome: AnalyticsOutcome;
  channelId: string;
}

export interface AnalyticsPost {
  id: string;
  content: string;
  publishDate: string;
  releaseUrl: string | null;
  thumbnailUrl: string | null;
  channel: {
    id: string;
    name: string;
    picture: string | null;
    providerIdentifier: string;
    providerName: string;
  };
  metrics: AnalyticsPostMetrics;
  /** True when live platform metrics could not be loaded (permissions, unsupported network, etc.). */
  metricsUnavailable: boolean;
}

export interface AnalyticsSummary {
  totals: AnalyticsTotals;
  /** Percentage of published posts among published + failed, or null when nothing ran. */
  successRate: number | null;
  channels: AnalyticsChannel[];
  activity: AnalyticsActivity[];
  posts: AnalyticsPost[];
}
