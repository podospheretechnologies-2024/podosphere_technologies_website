import dayjs from 'dayjs';
import { ExternalLink } from 'lucide-react';
import { Card } from '@/shared/components/ui/card';
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
        <h2 className="text-sm font-semibold">Detailed report</h2>
        <p className="text-muted-foreground mt-1 text-xs">
          Per-post performance metrics for the selected date range.
        </p>
      </div>

      {posts.length === 0 ? (
        <p className="text-muted-foreground text-sm">No published posts in this period.</p>
      ) : (
        <div className="border-border overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[960px] border-collapse text-left text-sm">
            <thead className="bg-surface-muted/60 text-muted-foreground text-xs">
              <tr>
                <th className="px-3 py-2.5 font-medium">Date</th>
                <th className="px-3 py-2.5 font-medium">Channel</th>
                <th className="px-3 py-2.5 font-medium">Post</th>
                {METRIC_COLUMNS.map((column) => (
                  <th key={column.key} className="px-3 py-2.5 text-right font-medium">
                    {column.label}
                  </th>
                ))}
                <th className="px-3 py-2.5 font-medium">Link</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {posts.map((post) => (
                <tr key={post.id} className="align-top">
                  <td className="text-muted-foreground whitespace-nowrap px-3 py-3 text-xs tabular-nums">
                    {dayjs(post.publishDate).format('D MMM YYYY')}
                    <br />
                    {dayjs(post.publishDate).format('h:mm A')}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex max-w-[180px] items-center gap-2">
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
                        <p className="truncate text-xs font-medium">{post.channel.name}</p>
                        <p className="text-muted-foreground truncate text-[11px]">
                          {post.channel.providerName}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex max-w-xs items-start gap-2">
                      {post.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={post.thumbnailUrl}
                          alt=""
                          className="bg-surface-muted size-10 shrink-0 rounded object-cover"
                        />
                      ) : null}
                      <p className="line-clamp-2 text-xs whitespace-pre-wrap">
                        {post.content.trim() || '(No caption)'}
                      </p>
                    </div>
                  </td>
                  {METRIC_COLUMNS.map((column) => (
                    <td
                      key={column.key}
                      className="px-3 py-3 text-right text-xs font-medium tabular-nums"
                    >
                      {formatMetric(post.metrics[column.key])}
                    </td>
                  ))}
                  <td className="px-3 py-3">
                    {post.releaseUrl ? (
                      <a
                        href={post.releaseUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs transition"
                      >
                        Open
                        <ExternalLink className="size-3" />
                      </a>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
