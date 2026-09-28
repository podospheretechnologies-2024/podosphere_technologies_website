'use client';

import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/cn';
import type { ChannelItem } from '../../types/integration';
import { ChannelAvatar } from './channel-avatar';

export type ChannelAction = 'toggle' | 'reconnect' | 'delete';

interface ChannelCardProps {
  channel: ChannelItem;
  busy: boolean;
  onAction: (action: ChannelAction, channel: ChannelItem) => void;
}

function ChannelStatus({ channel }: { channel: ChannelItem }) {
  if (channel.refreshNeeded) {
    return (
      <span className="bg-danger/10 text-danger rounded-md px-2 py-0.5">Reconnect needed</span>
    );
  }
  if (channel.disabled) {
    return (
      <span className="bg-surface-muted text-muted-foreground rounded-md px-2 py-0.5">
        Disabled
      </span>
    );
  }
  return <span className="bg-success/10 text-success rounded-md px-2 py-0.5">Active</span>;
}

export function ChannelCard({ channel, busy, onAction }: ChannelCardProps) {
  return (
    <div className="border-border bg-surface flex flex-col gap-4 rounded-xl border p-4">
      <div className="flex items-center gap-3">
        <ChannelAvatar
          name={channel.name}
          picture={channel.picture}
          className={cn(channel.disabled && 'opacity-50 grayscale')}
        />
        <div className="min-w-0">
          <p className="truncate font-medium" title={channel.name}>
            {channel.name}
          </p>
          <p className="text-muted-foreground truncate text-xs">
            {channel.providerName}
            {channel.username && ` · @${channel.username}`}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 text-xs font-medium">
        <ChannelStatus channel={channel} />
        <div className="flex items-center gap-1">
          {channel.refreshNeeded ? (
            <Button size="sm" disabled={busy} onClick={() => onAction('reconnect', channel)}>
              Reconnect
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => onAction('toggle', channel)}
            >
              {channel.disabled ? 'Enable' : 'Disable'}
            </Button>
          )}
          <Button
            variant="danger-ghost"
            size="sm"
            disabled={busy}
            onClick={() => onAction('delete', channel)}
            aria-label={`Delete ${channel.name}`}
          >
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}
