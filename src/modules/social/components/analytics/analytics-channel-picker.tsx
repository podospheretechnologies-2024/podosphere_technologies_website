'use client';

import { Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/shared/lib/cn';
import type { AnalyticsChannel } from '../../types/analytics';
import { ChannelAvatar } from '../channels/channel-avatar';
import { ProviderMark } from '../channels/provider-mark';

interface AnalyticsChannelPickerProps {
  channels: AnalyticsChannel[];
  value: string;
  onChange: (channelId: string) => void;
  /** Count badge helper: posts (published+failed) when available. */
  postCounts?: Map<string, number>;
}

export function AnalyticsChannelPicker({
  channels,
  value,
  onChange,
  postCounts,
}: AnalyticsChannelPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  const selected = value === 'all' ? null : channels.find((channel) => channel.id === value);

  const options = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = !q
      ? channels
      : channels.filter(
          (channel) =>
            channel.name.toLowerCase().includes(q) ||
            channel.providerName.toLowerCase().includes(q)
        );
    return [...filtered].sort((a, b) => {
      const countDiff =
        (postCounts?.get(b.id) ?? b.published + b.failed) -
        (postCounts?.get(a.id) ?? a.published + a.failed);
      return countDiff || a.name.localeCompare(b.name);
    });
  }, [channels, query, postCounts]);

  const allCount =
    postCounts
      ? [...postCounts.values()].reduce((sum, entry) => sum + entry, 0)
      : channels.reduce((sum, channel) => sum + channel.published + channel.failed, 0);

  function pick(id: string, label: string) {
    onChange(id);
    setQuery(id === 'all' ? '' : label);
    setOpen(false);
  }

  const selectedCount =
    value === 'all'
      ? allCount
      : (postCounts?.get(value) ??
        (selected ? selected.published + selected.failed : 0));

  return (
    <div ref={rootRef} className="relative w-full max-w-md">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label="Filter analytics by channel"
        className={cn(
          'border-border bg-surface-muted/50 hover:border-primary/40 flex h-11 w-full items-center gap-2.5 rounded-xl border px-3 text-left transition',
          open && 'border-primary ring-primary/25 ring-2'
        )}
      >
        {selected ? (
          <span className="relative shrink-0">
            <ChannelAvatar name={selected.name} picture={selected.picture} size="xs" />
            <ProviderMark
              identifier={selected.providerIdentifier}
              name={selected.providerName}
              size="sm"
              className="ring-surface absolute -right-0.5 -bottom-0.5 size-3 ring-1"
            />
          </span>
        ) : (
          <span className="bg-primary/15 text-primary flex size-7 shrink-0 items-center justify-center rounded-full">
            <Search className="size-3.5" />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="text-muted-foreground block text-[10px] font-semibold tracking-wide uppercase">
            Analytics by channel
          </span>
          <span className="block truncate text-sm font-medium">
            {selected?.name ?? 'All channels'}
          </span>
        </span>
        <span className="bg-primary/15 text-primary shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums">
          {selectedCount}
        </span>
      </button>

      {open && (
        <div className="border-border bg-surface absolute top-full right-0 left-0 z-30 mt-1.5 overflow-hidden rounded-xl border shadow-lg">
          <div className="border-border flex items-center gap-2 border-b px-3 py-2">
            <Search className="text-muted-foreground size-4 shrink-0" />
            <input
              type="search"
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search channels…"
              aria-label="Search channels"
              className="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
          </div>
          <ul role="listbox" className="max-h-72 overflow-y-auto py-1">
            <li>
              <button
                type="button"
                role="option"
                aria-selected={value === 'all'}
                onClick={() => pick('all', '')}
                className={cn(
                  'hover:bg-surface-muted flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm',
                  value === 'all' && 'bg-primary/10 text-primary font-semibold'
                )}
              >
                <span className="bg-primary/15 text-primary flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold">
                  A
                </span>
                <span className="min-w-0 flex-1 truncate">All channels</span>
                <span className="bg-surface-muted text-muted-foreground shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums">
                  {allCount}
                </span>
              </button>
            </li>
            {options.map((channel) => {
              const count =
                postCounts?.get(channel.id) ?? channel.published + channel.failed;
              return (
                <li key={channel.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={value === channel.id}
                    onClick={() => pick(channel.id, channel.name)}
                    className={cn(
                      'hover:bg-surface-muted flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm',
                      value === channel.id && 'bg-primary/10 text-primary font-semibold'
                    )}
                  >
                    <span className="relative shrink-0">
                      <ChannelAvatar
                        name={channel.name}
                        picture={channel.picture}
                        size="xs"
                      />
                      <ProviderMark
                        identifier={channel.providerIdentifier}
                        name={channel.providerName}
                        size="sm"
                        className="ring-surface absolute -right-0.5 -bottom-0.5 size-3 ring-1"
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{channel.name}</span>
                      <span className="text-muted-foreground block truncate text-xs font-normal">
                        {channel.providerName}
                      </span>
                    </span>
                    <span
                      className={cn(
                        'shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums',
                        count > 0
                          ? 'bg-primary/15 text-primary'
                          : 'bg-surface-muted text-muted-foreground'
                      )}
                    >
                      {count}
                    </span>
                  </button>
                </li>
              );
            })}
            {options.length === 0 && (
              <li className="text-muted-foreground px-3 py-4 text-center text-sm">
                No channels match your search.
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
