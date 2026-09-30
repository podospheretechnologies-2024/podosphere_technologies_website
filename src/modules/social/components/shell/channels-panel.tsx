'use client';

import { ChevronDown, ChevronLeft, MoreVertical, Plus, Search, Sparkles, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/cn';
import { SOCIAL_BASE_PATH } from '../../config/navigation';
import { useChannels } from '../../hooks/use-channels';
import { startChannelConnect } from '../../lib/integrations.client';
import type { AvailableProvider, ChannelItem } from '../../types/integration';
import { AddChannelDialog } from '../channels/add-channel-dialog';
import { ChannelAvatar } from '../channels/channel-avatar';
import { ProviderMark } from '../channels/provider-mark';

interface ChannelsPanelProps {
  onCreatePost: () => void;
}

interface ChannelGroup {
  key: string;
  label: string;
  channels: ChannelItem[];
}

function groupChannels(channels: ChannelItem[]): ChannelGroup[] {
  const map = new Map<string, ChannelGroup>();
  for (const channel of channels) {
    const key = channel.customer?.id ?? 'personal';
    const label = channel.customer?.name ?? 'Personal';
    const existing = map.get(key);
    if (existing) {
      existing.channels.push(channel);
    } else {
      map.set(key, { key, label, channels: [channel] });
    }
  }
  return [...map.values()].sort((a, b) => {
    if (a.key === 'personal') return 1;
    if (b.key === 'personal') return -1;
    return a.label.localeCompare(b.label);
  });
}

export function ChannelsPanel({ onCreatePost }: ChannelsPanelProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data, isLoading, mutate } = useChannels();
  const [collapsed, setCollapsed] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [menuId, setMenuId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const channels = data?.channels ?? [];
  const providers = data?.providers ?? [];
  const selectedId = searchParams.get('channel');
  const filteredChannels = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) {
      return channels;
    }
    return channels.filter(
      (channel) =>
        channel.name.toLowerCase().includes(q) ||
        (channel.username?.toLowerCase().includes(q) ?? false) ||
        channel.providerName.toLowerCase().includes(q) ||
        channel.providerIdentifier.toLowerCase().includes(q)
    );
  }, [channels, search]);
  const groups = useMemo(() => groupChannels(filteredChannels), [filteredChannels]);
  const isAgent = pathname.includes('/ai') || pathname.includes('/agent');

  async function connect(provider: AvailableProvider) {
    setConnecting(provider.identifier);
    try {
      await startChannelConnect(provider.identifier);
    } catch {
      setConnecting(null);
    }
  }

  function selectChannel(id: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (params.get('channel') === id) {
      params.delete('channel');
    } else {
      params.set('channel', id);
    }
    const query = params.toString();
    router.replace(`${pathname}${query ? `?${query}` : ''}`);
  }

  return (
    <>
      <aside
        className={cn(
          'bg-surface relative flex shrink-0 flex-col transition-all',
          collapsed ? 'w-[88px]' : 'w-[260px]'
        )}
      >
        <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
          <div className="flex items-center gap-2">
            {!collapsed && (
              <h2 className="flex-1 text-lg font-semibold">
                {isAgent ? 'Select Channels' : 'Channels'}
              </h2>
            )}
            <button
              type="button"
              onClick={() => setCollapsed((value) => !value)}
              aria-label={collapsed ? 'Expand channels' : 'Collapse channels'}
              className={cn(
                'bg-surface-muted text-muted-foreground hover:text-foreground flex size-6 items-center justify-center rounded-md transition',
                collapsed && 'mx-auto rotate-180'
              )}
            >
              <ChevronLeft className="size-3.5" />
            </button>
          </div>

          {!isAgent && (
            <div className={cn('flex flex-col gap-2', collapsed && 'items-center')}>
              <Button
                variant="secondary"
                className={cn('w-full justify-start', collapsed && 'size-11 justify-center px-0')}
                onClick={() => setDialogOpen(true)}
                title="Add Channel"
              >
                <Plus className="size-4" />
                {!collapsed && 'Add Channel'}
              </Button>
              <div className={cn('flex gap-2', collapsed && 'flex-col')}>
                <Button
                  className={cn('flex-1 justify-start', collapsed && 'size-11 justify-center px-0')}
                  onClick={onCreatePost}
                  disabled={channels.length === 0}
                  title="Create Post"
                >
                  <Plus className="size-4" />
                  {!collapsed && 'Create Post'}
                </Button>
                <Link
                  href={`${SOCIAL_BASE_PATH}/ai`}
                  title="Agent"
                  className="bg-ai inline-flex size-10 shrink-0 items-center justify-center rounded-lg text-white transition hover:opacity-90"
                >
                  <Sparkles className="size-4" />
                </Link>
              </div>
            </div>
          )}

          {isLoading && !data ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : channels.length === 0 && !collapsed ? (
            <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-2 px-2 text-center text-sm">
              <p className="text-foreground text-base font-semibold">No channels yet</p>
              <p>Connect an account to start scheduling posts.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {!collapsed && channels.length > 0 && (
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

              {filteredChannels.length === 0 && !collapsed ? (
                <p className="text-muted-foreground px-1 text-sm">
                  No channels match “{search}”.
                </p>
              ) : (
                groups.map((group) => {
                const groupCollapsed = collapsedGroups[group.key];
                return (
                  <div key={group.key}>
                    {!collapsed && (
                      <button
                        type="button"
                        onClick={() =>
                          setCollapsedGroups((current) => ({
                            ...current,
                            [group.key]: !current[group.key],
                          }))
                        }
                        className="text-muted-foreground hover:text-foreground mb-1 flex w-full items-center gap-1 px-1 text-xs font-semibold tracking-wide uppercase"
                      >
                        <ChevronDown
                          className={cn(
                            'size-3.5 transition',
                            groupCollapsed && '-rotate-90'
                          )}
                        />
                        {group.label}
                      </button>
                    )}
                    {!groupCollapsed && (
                      <ul className="flex flex-col gap-1">
                        {group.channels.map((channel) => {
                          const active = selectedId === channel.id;
                          return (
                            <li key={channel.id} className="relative">
                              <div
                                className={cn(
                                  'hover:bg-surface-muted relative flex w-full items-center gap-2 rounded-lg py-2 pr-1 pl-2 transition',
                                  active &&
                                    'bg-surface-muted before:bg-foreground before:absolute before:top-2 before:bottom-2 before:left-0 before:w-0.5 before:rounded-full',
                                  collapsed && 'justify-center px-0'
                                )}
                              >
                                <button
                                  type="button"
                                  onClick={() => selectChannel(channel.id)}
                                  title={channel.name}
                                  className={cn(
                                    'flex min-w-0 flex-1 items-center gap-3 text-left',
                                    collapsed && 'justify-center'
                                  )}
                                >
                                  <div className="relative shrink-0">
                                    <ChannelAvatar
                                      name={channel.name}
                                      picture={channel.picture}
                                      size="sm"
                                    />
                                    <ProviderMark
                                      identifier={channel.providerIdentifier}
                                      name={channel.providerName}
                                      size="sm"
                                      className="ring-surface absolute -right-1 -bottom-1 size-3.5 text-[7px] ring-2"
                                    />
                                  </div>
                                  {!collapsed && (
                                    <span className="min-w-0 flex-1">
                                      <span className="block truncate text-sm font-medium">
                                        {channel.name}
                                      </span>
                                      <span className="text-muted-foreground block truncate text-xs">
                                        {channel.providerName}
                                      </span>
                                    </span>
                                  )}
                                </button>
                                {!collapsed && (
                                  <button
                                    type="button"
                                    aria-label={`Options for ${channel.name}`}
                                    onClick={() =>
                                      setMenuId((current) =>
                                        current === channel.id ? null : channel.id
                                      )
                                    }
                                    className="text-muted-foreground hover:text-foreground rounded p-1"
                                  >
                                    <MoreVertical className="size-4" />
                                  </button>
                                )}
                              </div>
                              {menuId === channel.id && !collapsed && (
                                <div className="border-border bg-surface absolute top-10 right-2 z-20 min-w-36 rounded-lg border py-1 text-sm shadow-lg">
                                  <button
                                    type="button"
                                    className="hover:bg-surface-muted w-full px-3 py-1.5 text-left"
                                    onClick={() => {
                                      selectChannel(channel.id);
                                      setMenuId(null);
                                    }}
                                  >
                                    Select
                                  </button>
                                  <Link
                                    href={`${SOCIAL_BASE_PATH}/channels`}
                                    className="hover:bg-surface-muted block px-3 py-1.5"
                                    onClick={() => setMenuId(null)}
                                  >
                                    Manage
                                  </Link>
                                </div>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                );
              })
              )}
            </div>
          )}
        </div>
      </aside>

      <AddChannelDialog
        open={dialogOpen}
        providers={providers}
        connecting={connecting}
        onClose={() => {
          setDialogOpen(false);
          void mutate();
        }}
        onSelect={connect}
      />
    </>
  );
}
