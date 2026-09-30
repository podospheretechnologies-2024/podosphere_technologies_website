import { Card } from '@/shared/components/ui/card';
import type { AnalyticsChannel } from '../../types/analytics';
import { ChannelAvatar } from '../channels/channel-avatar';

interface ChannelBreakdownProps {
  channels: AnalyticsChannel[];
}

export function ChannelBreakdown({ channels }: ChannelBreakdownProps) {
  const max = Math.max(1, ...channels.map((channel) => channel.published + channel.failed));

  return (
    <Card className="space-y-4">
      <h2 className="text-sm font-semibold">By channel</h2>
      {channels.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No channels connected yet. Add one from the Channels section.
        </p>
      ) : (
        <ul className="space-y-4">
          {channels.map((channel) => {
            const total = channel.published + channel.failed;
            return (
              <li key={channel.id} className="flex items-center gap-3">
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
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
