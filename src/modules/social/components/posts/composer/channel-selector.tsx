'use client';

import { cn } from '@/shared/lib/cn';
import type { ChannelItem } from '../../../types/integration';
import { ChannelAvatar } from '../../channels/channel-avatar';

interface ChannelSelectorProps {
  channels: ChannelItem[];
  selectedIds: string[];
  onToggle: (id: string) => void;
}

function unavailableReason(channel: ChannelItem): string | null {
  if (channel.refreshNeeded) {
    return 'Reconnect needed';
  }
  if (channel.disabled) {
    return 'Disabled';
  }
  return null;
}

export function ChannelSelector({ channels, selectedIds, onToggle }: ChannelSelectorProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {channels.map((channel) => {
        const selected = selectedIds.includes(channel.id);
        const reason = unavailableReason(channel);
        return (
          <button
            key={channel.id}
            type="button"
            onClick={() => onToggle(channel.id)}
            disabled={Boolean(reason) && !selected}
            aria-pressed={selected}
            title={reason ?? `${channel.name} (${channel.providerName})`}
            className={cn(
              'flex items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-sm transition disabled:cursor-not-allowed disabled:opacity-40',
              selected
                ? 'border-primary bg-primary/10'
                : 'border-border hover:bg-surface-muted opacity-70 hover:opacity-100'
            )}
          >
            <ChannelAvatar name={channel.name} picture={channel.picture} size="sm" />
            <span className="max-w-40 truncate">{channel.name}</span>
          </button>
        );
      })}
    </div>
  );
}
