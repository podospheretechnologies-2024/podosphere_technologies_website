import dayjs, { type Dayjs } from 'dayjs';
import type {
  AnalyticsChannel,
  AnalyticsPost,
  AnalyticsSummary,
} from '../types/analytics';

function csvEscape(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? '' : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

function downloadBlob(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function metric(value: number | null | undefined): string {
  return value === null || value === undefined ? '' : String(value);
}

function postsCsv(posts: AnalyticsPost[]): string {
  const header = [
    'Date',
    'Channel',
    'Platform',
    'Content',
    'Likes',
    'Views',
    'Comments',
    'Shares',
    'Reach',
    'Impressions',
    'Engagement',
    'Saved',
    'Clicks',
    'URL',
  ];
  const rows = posts.map((post) =>
    [
      dayjs(post.publishDate).format('YYYY-MM-DD HH:mm'),
      post.channel.name,
      post.channel.providerName,
      post.content,
      metric(post.metrics.likes),
      metric(post.metrics.views),
      metric(post.metrics.comments),
      metric(post.metrics.shares),
      metric(post.metrics.reach),
      metric(post.metrics.impressions),
      metric(post.metrics.engagement),
      metric(post.metrics.saved),
      metric(post.metrics.clicks),
      post.releaseUrl ?? '',
    ]
      .map(csvEscape)
      .join(',')
  );
  return [header.join(','), ...rows].join('\n');
}

function channelsCsv(channels: AnalyticsChannel[]): string {
  const header = ['Channel', 'Platform', 'Published', 'Failed'];
  const rows = channels.map((channel) =>
    [channel.name, channel.providerName, channel.published, channel.failed]
      .map(csvEscape)
      .join(',')
  );
  return [header.join(','), ...rows].join('\n');
}

function summaryCsv(data: AnalyticsSummary, start: Dayjs, end: Dayjs): string {
  return [
    ['Report start', start.format('YYYY-MM-DD')].map(csvEscape).join(','),
    ['Report end', end.subtract(1, 'day').format('YYYY-MM-DD')].map(csvEscape).join(','),
    ['Posts published', data.totals.published].map(csvEscape).join(','),
    ['Failed posts', data.totals.failed].map(csvEscape).join(','),
    ['Success rate %', data.successRate ?? ''].map(csvEscape).join(','),
    ['Scheduled', data.totals.scheduled].map(csvEscape).join(','),
    ['Drafts', data.totals.drafts].map(csvEscape).join(','),
  ].join('\n');
}

export function downloadAnalyticsReport(
  data: AnalyticsSummary,
  range: { start: Dayjs; end: Dayjs }
) {
  const stamp = `${range.start.format('YYYYMMDD')}-${range.end.subtract(1, 'day').format('YYYYMMDD')}`;
  const content = [
    'Podosphere Analytics Report',
    '',
    'Summary',
    summaryCsv(data, range.start, range.end),
    '',
    'By channel',
    channelsCsv(data.channels),
    '',
    'Detailed posts',
    postsCsv(data.posts),
    '',
  ].join('\n');

  downloadBlob(`podosphere-analytics-${stamp}.csv`, content, 'text/csv;charset=utf-8');
}
