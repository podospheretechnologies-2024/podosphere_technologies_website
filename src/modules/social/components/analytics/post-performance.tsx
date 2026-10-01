import dayjs from 'dayjs';
import { ExternalLink } from 'lucide-react';
import { Card } from '@/shared/components/ui/card';
import { cn } from '@/shared/lib/cn';
import type { AnalyticsPost, AnalyticsPostMetrics } from '../../types/analytics';
import { ChannelAvatar } from '../channels/channel-avatar';
import { ProviderMark } from '../channels/provider-mark';

interface PostPerformanceProps {
  posts: AnalyticsPost[];
}

const METRIC_COLUMNS: { key: keyof AnalyticsPostMetrics; label: string }[] = [
  { key: 'likes', label: 'Likes' },
  { key: 'views', label: 'Views' },
  { key: 'comments', label: 'Comments' },
  { key: 'shares', label: 'Shares' },
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

export function PostPerformance({ posts }: PostPerformanceProps) {
  return (
    <Card className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold">Published posts</h2>
        <p className="text-muted-foreground mt-1 text-xs">
          Each published post with likes, views, comments, shares, reach, engagement, and other
          available metrics.
        </p>
      </div>

      {posts.length === 0 ? (
        <p className="text-muted-foreground text-sm">No published posts in this period.</p>
      ) : (
        <ul className="space-y-3">
          {posts.map((post) => (
            <li
              key={post.id}
              className="border-border bg-surface-muted/20 rounded-xl border p-3 sm:p-4"
            >
              <div className="flex flex-wrap items-start gap-3">
                {post.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={post.thumbnailUrl}
                    alt=""
                    className="bg-surface-muted size-14 shrink-0 rounded-lg object-cover"
                  />
                ) : null}
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="relative shrink-0">
                        <ChannelAvatar
                          name={post.channel.name}
                          picture={post.channel.picture}
                          size="xs"
                        />
                        <ProviderMark
                          identifier={post.channel.providerIdentifier}
                          name={post.channel.providerName}
                          size="sm"
                          className="ring-surface absolute -right-0.5 -bottom-0.5 size-3 ring-1"
                        />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {post.channel.name}
                          <span className="text-muted-foreground font-normal">
                            {' '}
                            · {post.channel.providerName}
                          </span>
                        </p>
                        <p className="text-muted-foreground text-xs tabular-nums">
                          {dayjs(post.publishDate).format('ddd, D MMM YYYY · h:mm A')}
                        </p>
                      </div>
                    </div>
                    {post.releaseUrl ? (
                      <a
                        href={post.releaseUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs transition"
                      >
                        Open post
                        <ExternalLink className="size-3" />
                      </a>
                    ) : null}
                  </div>

                  <p className="text-foreground line-clamp-3 text-sm whitespace-pre-wrap">
                    {post.content.trim() || '(No caption)'}
                  </p>

                  {post.metricsUnavailable ? (
                    <p className="text-muted-foreground text-xs">
                      Live metrics unavailable for this post (missing permissions, unsupported
                      network, or no release id).
                    </p>
                  ) : null}

                  <dl className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-9">
                    {METRIC_COLUMNS.map((column) => (
                      <div
                        key={column.key}
                        className={cn(
                          'border-border bg-surface rounded-lg border px-2 py-1.5 text-center'
                        )}
                      >
                        <dt className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
                          {column.label}
                        </dt>
                        <dd className="mt-0.5 text-sm font-semibold tabular-nums">
                          {formatMetric(post.metrics[column.key])}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
