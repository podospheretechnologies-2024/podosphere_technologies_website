import dayjs from 'dayjs';
import { ExternalLink } from 'lucide-react';
import { Card } from '@/shared/components/ui/card';
import type { AnalyticsPost } from '../../types/analytics';
import { ChannelAvatar } from '../channels/channel-avatar';
import { ProviderMark } from '../channels/provider-mark';

interface PostTimelineProps {
  posts: AnalyticsPost[];
}

export function PostTimeline({ posts }: PostTimelineProps) {
  const chronological = [...posts].sort(
    (a, b) => dayjs(b.publishDate).valueOf() - dayjs(a.publishDate).valueOf()
  );

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold">Post timeline</h2>
        <p className="text-muted-foreground mt-1 text-xs">
          Chronological view of published posts in the selected date range.
        </p>
      </div>

      {chronological.length === 0 ? (
        <p className="text-muted-foreground text-sm">No published posts in this period.</p>
      ) : (
        <ol className="relative space-y-0">
          {chronological.map((post, index) => {
            const isLast = index === chronological.length - 1;
            return (
              <li key={post.id} className="relative flex gap-3 pb-5">
                {!isLast && (
                  <span
                    aria-hidden
                    className="bg-border absolute top-8 bottom-0 left-[15px] w-px"
                  />
                )}
                <div className="bg-surface relative z-10 flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full ring-2 ring-[var(--border)]">
                  <ChannelAvatar
                    name={post.channel.name}
                    picture={post.channel.picture}
                    size="sm"
                  />
                </div>
                <div className="border-border bg-surface-muted/30 min-w-0 flex-1 rounded-xl border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <ProviderMark
                          identifier={post.channel.providerIdentifier}
                          name={post.channel.providerName}
                          size="sm"
                          className="size-4 shrink-0"
                        />
                        <p className="truncate text-sm font-medium">
                          {post.channel.name}{' '}
                          <span className="text-muted-foreground font-normal">
                            · {post.channel.providerName}
                          </span>
                        </p>
                      </div>
                      <p className="text-foreground line-clamp-2 text-sm whitespace-pre-wrap">
                        {post.content.trim() || '(No caption)'}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {dayjs(post.publishDate).format('ddd, D MMM YYYY · h:mm A')}
                      </p>
                    </div>
                    {post.releaseUrl && (
                      <a
                        href={post.releaseUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground inline-flex shrink-0 items-center gap-1 text-xs transition"
                      >
                        Open
                        <ExternalLink className="size-3" />
                      </a>
                    )}
                  </div>
                  <div className="text-muted-foreground mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] tabular-nums">
                    <span>Likes {post.metrics.likes ?? '—'}</span>
                    <span>Views {post.metrics.views ?? '—'}</span>
                    <span>Comments {post.metrics.comments ?? '—'}</span>
                    <span>Reach {post.metrics.reach ?? '—'}</span>
                    <span>Engagement {post.metrics.engagement ?? '—'}</span>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}
