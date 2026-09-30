'use client';

import { Power, RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/cn';
import type { ChannelItem } from '../../types/integration';
import { ChannelAvatar } from './channel-avatar';
import { ProviderMark } from './provider-mark';

export type ChannelAction = 'toggle' | 'reconnect' | 'delete';

interface ChannelCardProps {
  channel: ChannelItem;
  busy: boolean;
  onAction: (action: ChannelAction, channel: ChannelItem) => void;
}

function ChannelStatus({ channel }: { channel: ChannelItem }) {
  const status = channel.refreshNeeded
    ? { label: 'Reconnect needed', className: 'bg-danger/10 text-danger', dot: 'bg-danger' }
    : channel.disabled
      ? {
          label: 'Disabled',
          className: 'bg-surface-muted text-muted-foreground',
          dot: 'bg-muted-foreground',
        }
      : { label: 'Active', className: 'bg-success/10 text-success', dot: 'bg-success' };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
        status.className
      )}
    >
      <span className={cn('size-1.5 rounded-full', status.dot)} />
      {status.label}
    </span>
  );
}

export function ChannelCard({ channel, busy, onAction }: ChannelCardProps) {
  return (
    <div
      className={cn(
        'border-border bg-surface hover:border-primary/40 flex flex-col overflow-hidden rounded-xl border shadow-sm transition hover:shadow-md',
        channel.refreshNeeded && 'border-danger/40'
      )}
    >
      <div className="flex items-start gap-3 p-5">
        <div className="relative">
          <ChannelAvatar
            name={channel.name}
            picture={channel.picture}
            className={cn(channel.disabled && 'opacity-50 grayscale')}
          />
          <ProviderMark
            identifier={channel.providerIdentifier}
            name={channel.providerName}
            size="sm"
            className="ring-surface absolute -right-1 -bottom-1 ring-2"
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold" title={channel.name}>
            {channel.name}
          </p>
          <p className="text-muted-foreground truncate text-xs">
            {channel.providerName}
            {channel.username && ` · @${channel.username}`}
          </p>
          <div className="mt-2.5">
            <ChannelStatus channel={channel} />
          </div>
        </div>
      </div>

      <div className="border-border bg-surface-muted/30 mt-auto flex items-center justify-between gap-2 border-t px-3 py-2">
        {channel.refreshNeeded ? (
          <Button size="sm" disabled={busy} onClick={() => onAction('reconnect', channel)}>
            <RefreshCw className="size-3.5" />
            Reconnect
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => onAction('toggle', channel)}
          >
            <Power className="size-3.5" />
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
          <Trash2 className="size-3.5" />
          Delete
        </Button>
      </div>
    </div>
  );
}
