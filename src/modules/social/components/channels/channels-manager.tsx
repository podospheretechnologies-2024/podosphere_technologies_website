'use client';

import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { useChannels } from '../../hooks/use-channels';
import {
  deleteChannel,
  setChannelDisabled,
  startChannelConnect,
} from '../../lib/integrations.client';
import type { AvailableProvider, ChannelItem } from '../../types/integration';
import { AddChannelDialog } from './add-channel-dialog';
import { ChannelCard, type ChannelAction } from './channel-card';

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
  const addButton = (
    <Button onClick={() => setDialogOpen(true)} disabled={!data}>
      Add channel
    </Button>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          {data ? `${channels.length} connected` : ' '}
        </p>
        {addButton}
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
        <EmptyState
          title="No channels connected yet"
          description="Connect a social account to start scheduling and publishing posts to it."
          action={addButton}
        />
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
