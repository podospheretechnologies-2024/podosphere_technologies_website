import dayjs from 'dayjs';
import { ExternalLink } from 'lucide-react';
import { Card } from '@/shared/components/ui/card';
import type { AnalyticsChannel, AnalyticsPost, AnalyticsPostMetrics } from '../../types/analytics';
import { ChannelAvatar } from '../channels/channel-avatar';
import { ProviderMark } from '../channels/provider-mark';

interface ChannelBreakdownProps {
  channels: AnalyticsChannel[];
  posts: AnalyticsPost[];
}

const METRIC_LABELS: { key: keyof AnalyticsPostMetrics; label: string }[] = [
  { key: 'likes', label: 'Likes' },
  { key: 'comments', label: 'Comments' },
  { key: 'shares', label: 'Shares' },
  { key: 'views', label: 'Views' },
  { key: 'reach', label: 'Reach' },
  { key: 'impressions', label: 'Impressions' },
  { key: 'engagement', label: 'Engagement' },
  { key: 'saved', label: 'Saved' },
  { key: 'clicks', label: 'Clicks' },
];

function formatMetric(value: number | null): string {
  if (value === null) return '—';
  return new Intl.NumberFormat('en', { maximumFractionDigits: 0 }).format(value);
}

function MetricsStrip({ metrics }: { metrics: AnalyticsPostMetrics }) {
  return (
    <div className="border-border bg-surface-muted/40 grid grid-cols-3 gap-2 rounded-xl border p-2.5 sm:grid-cols-5 lg:grid-cols-9">
      {METRIC_LABELS.map((metric) => (
        <div key={metric.key} className="min-w-0 px-1 py-0.5 text-center">
          <p className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
            {metric.label}
          </p>
          <p className="text-foreground mt-0.5 text-sm font-semibold tabular-nums">
            {formatMetric(metrics[metric.key])}
          </p>
        </div>
      ))}
    </div>
  );
}

export function ChannelBreakdown({ channels, posts }: ChannelBreakdownProps) {
  const max = Math.max(1, ...channels.map((channel) => channel.published + channel.failed));

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold">By channel</h2>
        <p className="text-muted-foreground mt-1 text-xs">
          Live Meta metrics for published posts in the selected period (likes, comments, shares,
          views, reach, impressions, and more), plus publish success history.
        </p>
      </div>
      {channels.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No channels connected yet. Add one from the Channels section.
        </p>
      ) : (
        <ul className="space-y-5">
          {channels.map((channel) => {
            const total = channel.published + channel.failed;
            const channelPosts = posts.filter((post) => post.channel.id === channel.id);
            return (
              <li key={channel.id} className="space-y-3">
                <div className="flex items-center gap-3">
                  <ChannelAvatar name={channel.name} picture={channel.picture} size="sm" />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <p className="truncate">
                        <span className="font-medium">{channel.name}</span>{' '}
                        <span className="text-muted-foreground">{channel.providerName}</span>
                      </p>
                      <p className="text-muted-foreground shrink-0">
                        <span className="text-success">{channel.published} published</span>
                        {channel.failed > 0 && (
                          <span className="text-danger"> · {channel.failed} failed</span>
                        )}
                      </p>
                    </div>
                    <div className="bg-surface-muted flex h-1.5 overflow-hidden rounded-full">
                      <div
                        className="bg-success"
                        style={{ width: `${(channel.published / max) * 100}%` }}
                      />
                      <div
                        className="bg-danger"
                        style={{ width: `${(channel.failed / max) * 100}%` }}
                      />
                    </div>
                    {total === 0 && (
                      <p className="text-muted-foreground text-xs">No posts in this period</p>
                    )}
                  </div>
                </div>

                {channelPosts.length > 0 && <MetricsStrip metrics={channel.metrics} />}

                {channelPosts.length > 0 && (
                  <ul className="border-border ml-2 space-y-2 border-l pl-4">
                    {channelPosts.map((post) => (
                      <li
                        key={post.id}
                        className="border-border bg-surface-muted/30 rounded-lg border px-3 py-2.5"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="mb-1 flex items-center gap-1.5">
                              <ProviderMark
                                identifier={post.channel.providerIdentifier}
                                name={post.channel.providerName}
                                size="sm"
                                className="size-3.5 shrink-0"
                              />
                              <p className="text-muted-foreground text-[11px] tabular-nums">
                                {dayjs(post.publishDate).format('D MMM YYYY · h:mm A')}
                              </p>
                              {post.metricsUnavailable && (
                                <span className="text-muted-foreground text-[10px]">
                                  · metrics unavailable
                                </span>
                              )}
                            </div>
                            <p className="line-clamp-2 text-sm whitespace-pre-wrap">
                              {post.content.trim() || '(No caption)'}
                            </p>
                          </div>
                          {post.releaseUrl ? (
                            <a
                              href={post.releaseUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-muted-foreground hover:text-foreground inline-flex shrink-0 items-center gap-1 text-xs"
                            >
                              Open
                              <ExternalLink className="size-3" />
                            </a>
                          ) : null}
                        </div>
                        <div className="text-muted-foreground mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] tabular-nums">
                          {METRIC_LABELS.map((metric) => (
                            <span key={metric.key}>
                              {metric.label}{' '}
                              <strong className="text-foreground">
                                {formatMetric(post.metrics[metric.key])}
                              </strong>
                            </span>
                          ))}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
