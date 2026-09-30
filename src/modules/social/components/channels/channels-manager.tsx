'use client';

import { Plus, Share2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { cn } from '@/shared/lib/cn';
import { useChannels } from '../../hooks/use-channels';
import {
  deleteChannel,
  setChannelDisabled,
  startChannelConnect,
} from '../../lib/integrations.client';
import type { AvailableProvider, ChannelItem } from '../../types/integration';
import { AddChannelDialog } from './add-channel-dialog';
import { ChannelCard, type ChannelAction } from './channel-card';
import { ProviderMark } from './provider-mark';

interface ChannelsManagerProps {
  connected?: string;
  connectError?: string;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function ChannelsManager({ connected, connectError }: ChannelsManagerProps) {
  const { data, error, isLoading, mutate } = useChannels();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(connectError ?? null);
  const [notice, setNotice] = useState<string | null>(
    connected ? `${connected} was connected successfully.` : null
  );

  async function connect(identifier: string, refreshId?: string) {
    setActionError(null);
    setConnecting(identifier);
    try {
      await startChannelConnect(identifier, refreshId);
    } catch (connectFailure) {
      setActionError(errorMessage(connectFailure, 'Could not start the connection'));
      setConnecting(null);
    }
  }

  async function handleAction(action: ChannelAction, channel: ChannelItem) {
    if (action === 'reconnect') {
      await connect(channel.providerIdentifier, channel.id);
      return;
    }
    if (
      action === 'delete' &&
      !window.confirm(`Delete ${channel.name}? Scheduled posts for this channel will not be sent.`)
    ) {
      return;
    }

    setActionError(null);
    setNotice(null);
    setBusyId(channel.id);
    try {
      if (action === 'delete') {
        await deleteChannel(channel.id);
      } else {
        await setChannelDisabled(channel.id, !channel.disabled);
      }
      await mutate();
    } catch (actionFailure) {
      setActionError(errorMessage(actionFailure, 'Something went wrong'));
    } finally {
      setBusyId(null);
    }
  }

  function handleSelectProvider(provider: AvailableProvider) {
    void connect(provider.identifier);
  }

  const channels = data?.channels ?? [];
  const providers = data?.providers ?? [];
  const stats = [
    { label: 'Connected', value: channels.length, className: 'text-foreground' },
    {
      label: 'Active',
      value: channels.filter((channel) => !channel.disabled && !channel.refreshNeeded).length,
      className: 'text-success',
    },
    {
      label: 'Need attention',
      value: channels.filter((channel) => channel.refreshNeeded).length,
      className: 'text-danger',
    },
  ];
  const addButton = (
    <Button onClick={() => setDialogOpen(true)} disabled={!data}>
      <Plus className="size-4" />
      Add channel
    </Button>
  );

  return (
    <div className="space-y-6">
      <div className="border-border bg-surface flex flex-wrap items-center gap-x-8 gap-y-3 rounded-xl border px-5 py-4 shadow-sm">
        {stats.map((stat) => (
          <div key={stat.label}>
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              {stat.label}
            </p>
            <p className={cn('text-xl font-semibold tabular-nums', stat.className)}>
              {data ? stat.value : '—'}
            </p>
          </div>
        ))}
        <div className="ml-auto">{addButton}</div>
      </div>

      {notice && (
        <div
          role="status"
          className="border-success/40 bg-success/10 text-success rounded-lg border p-4 text-sm"
        >
          {notice}
        </div>
      )}
      {actionError && (
        <div
          role="alert"
          className="border-danger/40 bg-danger/10 text-danger rounded-lg border p-4 text-sm"
        >
          {actionError}
        </div>
      )}

      {error && !data ? (
        <EmptyState
          title="Could not load channels"
          description={errorMessage(error, '')}
          action={<Button onClick={() => mutate()}>Try again</Button>}
        />
      ) : isLoading && !data ? (
        <p className="text-muted-foreground text-sm">Loading channels…</p>
      ) : channels.length === 0 ? (
        <div className="border-border bg-surface flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-16 text-center">
          <div className="bg-primary/10 text-primary mb-5 flex size-14 items-center justify-center rounded-2xl">
            <Share2 className="size-6" />
          </div>
          <h3 className="text-lg font-semibold">No channels connected yet</h3>
          <p className="text-muted-foreground mt-2 max-w-md text-sm">
            Connect a social account to start scheduling and publishing posts to it.
          </p>
          {providers.length > 0 && (
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              {providers.map((provider) => (
                <span
                  key={provider.identifier}
                  className="border-border flex items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-xs font-medium"
                >
                  <ProviderMark identifier={provider.identifier} name={provider.name} size="sm" />
                  {provider.name}
                </span>
              ))}
            </div>
          )}
          <div className="mt-6">{addButton}</div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {channels.map((channel) => (
            <ChannelCard
              key={channel.id}
              channel={channel}
              busy={busyId === channel.id || connecting !== null}
              onAction={handleAction}
            />
          ))}
        </div>
      )}

      <AddChannelDialog
        open={dialogOpen}
        providers={data?.providers ?? []}
        connecting={connecting}
        onClose={() => setDialogOpen(false)}
        onSelect={handleSelectProvider}
      />
    </div>
  );
}
