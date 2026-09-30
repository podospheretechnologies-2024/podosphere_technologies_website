'use client';

import { Globe, Search, UserPlus, X } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { cn } from '@/shared/lib/cn';
import { SOCIAL_BASE_PATH } from '../../../config/navigation';
import type { ChannelItem } from '../../../types/integration';
import { ChannelAvatar } from '../../channels/channel-avatar';
import { ProviderMark } from '../../channels/provider-mark';

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

function matchesQuery(channel: ChannelItem, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) {
    return true;
  }
  return (
    channel.name.toLowerCase().includes(q) ||
    (channel.username?.toLowerCase().includes(q) ?? false) ||
    channel.providerName.toLowerCase().includes(q) ||
    channel.providerIdentifier.toLowerCase().includes(q)
  );
}

export function ChannelSelector({ channels, selectedIds, onToggle }: ChannelSelectorProps) {
  const [providerFilter, setProviderFilter] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const filtered = useMemo(
    () => channels.filter((channel) => matchesQuery(channel, search)),
    [channels, search]
  );

  const visible = providerFilter
    ? filtered.filter((channel) => channel.providerIdentifier === providerFilter)
    : filtered;

  const selectedChannels = channels.filter((channel) => selectedIds.includes(channel.id));

  return (
    <div className="space-y-3">
      {channels.length > 0 && (
        <label className="border-border bg-surface-muted/40 focus-within:border-primary relative flex h-9 items-center gap-2 rounded-lg border px-2.5 transition">
          <Search className="text-muted-foreground size-3.5 shrink-0" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search channels…"
            aria-label="Search channels"
            className="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label="Clear search"
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </label>
      )}

      <div className="flex max-h-40 flex-wrap items-center gap-3 overflow-y-auto pr-1">
        {visible.length === 0 ? (
          <p className="text-muted-foreground text-sm">No channels match “{search}”.</p>
        ) : (
          visible.map((channel) => {
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
                  'relative rounded-full transition disabled:cursor-not-allowed disabled:opacity-40',
                  selected
                    ? 'ring-primary ring-offset-surface ring-2 ring-offset-2'
                    : 'opacity-80 hover:opacity-100'
                )}
              >
                <ChannelAvatar name={channel.name} picture={channel.picture} size="md" />
                <ProviderMark
                  identifier={channel.providerIdentifier}
                  name={channel.providerName}
                  size="sm"
                  className="ring-surface absolute -right-0.5 -bottom-0.5 size-4 ring-2"
                />
              </button>
            );
          })
        )}
        <Link
          href={`${SOCIAL_BASE_PATH}/channels`}
          title="Add channel"
          className="border-border bg-surface-muted text-muted-foreground hover:bg-surface-muted/80 hover:text-foreground flex size-10 items-center justify-center rounded-full border transition"
        >
          <UserPlus className="size-4" />
        </Link>
      </div>

      {channels.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setProviderFilter(null)}
            aria-pressed={providerFilter === null}
            title="Global edit"
            className={cn(
              'flex size-8 items-center justify-center rounded-lg border transition',
              providerFilter === null
                ? 'border-primary bg-primary/15 text-primary'
                : 'border-border text-muted-foreground hover:bg-surface-muted hover:text-foreground'
            )}
          >
            <Globe className="size-4" />
          </button>
          {selectedChannels.map((channel) => (
            <button
              key={`selected-${channel.id}`}
              type="button"
              onClick={() =>
                setProviderFilter((current) =>
                  current === channel.providerIdentifier ? null : channel.providerIdentifier
                )
              }
              aria-pressed={providerFilter === channel.providerIdentifier}
              title={channel.name}
              className={cn(
                'relative rounded-full border p-0.5 transition',
                providerFilter === channel.providerIdentifier
                  ? 'border-primary ring-primary ring-1'
                  : 'border-border hover:bg-surface-muted opacity-90 hover:opacity-100'
              )}
            >
              <ChannelAvatar name={channel.name} picture={channel.picture} size="sm" />
              <ProviderMark
                identifier={channel.providerIdentifier}
                name={channel.providerName}
                size="sm"
                className="ring-surface absolute -right-0.5 -bottom-0.5 size-3.5 ring-1"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
