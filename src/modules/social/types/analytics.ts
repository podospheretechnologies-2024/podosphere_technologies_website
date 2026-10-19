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

/** One weekday × hour cell for the best-times heatmap (0 = Sunday). */
export interface BestTimesCell {
  weekday: number;
  hour: number;
  postCount: number;
  /** Mean of likes + comments + reach across posts in this slot. */
  avgScore: number;
  totalLikes: number;
  totalComments: number;
  totalReach: number;
}

export interface BestTimesSuggestion {
  weekday: number;
  hour: number;
  avgScore: number;
  postCount: number;
  label: string;
}

export interface BestTimesResult {
  integrationId: string;
  channelName: string;
  providerIdentifier: string;
  timeZone: string;
  lookbackDays: number;
  postCount: number;
  /** Dense 7×24 grid (Sun→Sat, hours 0–23). */
  cells: BestTimesCell[];
  /** Top slots by avgScore (min sample size applied server-side). */
  suggested: BestTimesSuggestion[];
}
