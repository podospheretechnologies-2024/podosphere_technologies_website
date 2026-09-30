export type AnalyticsOutcome = 'published' | 'error';

export interface AnalyticsTotals {
  published: number;
  failed: number;
  /** Upcoming queued posts, independent of the selected range. */
  scheduled: number;
  drafts: number;
}

export interface AnalyticsChannel {
  id: string;
  name: string;
  picture: string | null;
  providerName: string;
  published: number;
  failed: number;
}

export interface AnalyticsActivity {
  date: string;
  outcome: AnalyticsOutcome;
}

export interface AnalyticsSummary {
  totals: AnalyticsTotals;
  /** Percentage of published posts among published + failed, or null when nothing ran. */
  successRate: number | null;
  channels: AnalyticsChannel[];
  activity: AnalyticsActivity[];
}
