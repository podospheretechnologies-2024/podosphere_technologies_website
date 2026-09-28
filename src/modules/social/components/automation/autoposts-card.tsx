'use client';

import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { useAutoposts } from '../../hooks/use-automation';
import { deleteAutopost, runAutopost } from '../../lib/automation.client';
import { revalidatePosts } from '../../lib/posts.client';
import type { AutopostItem } from '../../types/automation';
import type { ChannelItem } from '../../types/integration';
import { AutopostDialog } from './autopost-dialog';

type DialogState = { open: false } | { open: true; autopost: AutopostItem | null };

interface AutopostsCardProps {
  channels: ChannelItem[];
  aiConfigured: boolean;
}

export function AutopostsCard({ channels, aiConfigured }: AutopostsCardProps) {
  const { data, error, mutate } = useAutoposts();
  const [dialog, setDialog] = useState<DialogState>({ open: false });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const channelNames = new Map(channels.map((channel) => [channel.id, channel.name]));

  async function runAction(autopost: AutopostItem, action: () => Promise<void>) {
    setActionError(null);
    setNotice(null);
    setBusyId(autopost.id);
    try {
      await action();
    } catch (actionFailure) {
      setActionError(
        actionFailure instanceof Error ? actionFailure.message : 'Something went wrong'
      );
    } finally {
      setBusyId(null);
    }
  }

  function checkNow(autopost: AutopostItem) {
    return runAction(autopost, async () => {
      const { created } = await runAutopost(autopost.id);
      setNotice(
        created === 0
          ? `${autopost.title}: no new items.`
          : `${autopost.title}: ${created} post${created === 1 ? '' : 's'} created.`
      );
      await Promise.all([mutate(), created > 0 && revalidatePosts()]);
    });
  }

  function remove(autopost: AutopostItem) {
    if (!window.confirm(`Delete the feed "${autopost.title}"? Posts already created stay.`)) {
      return;
    }
    return runAction(autopost, async () => {
      await deleteAutopost(autopost.id);
      await mutate();
    });
  }

  return (
    <Card className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">RSS auto-post</h2>
          <p className="text-muted-foreground text-sm">
            Feeds are checked every 15 minutes while the worker runs; new items become posts.
          </p>
        </div>
        <Button size="sm" onClick={() => setDialog({ open: true, autopost: null })}>
          Add feed
        </Button>
      </div>

      {notice && (
        <div
          role="status"
          className="border-success/40 bg-success/10 text-success rounded-lg border p-3 text-sm"
        >
          {notice}
        </div>
      )}
      {actionError && (
        <div
          role="alert"
          className="border-danger/40 bg-danger/10 text-danger rounded-lg border p-3 text-sm"
        >
          {actionError}
        </div>
      )}

      {error && !data ? (
        <p className="text-danger text-sm">
          {error instanceof Error ? error.message : 'Could not load feeds'}
        </p>
      ) : !data ? (
        <p className="text-muted-foreground text-sm">Loading feeds…</p>
      ) : data.length === 0 ? (
        <p className="text-muted-foreground text-sm">No feeds yet.</p>
      ) : (
        <ul className="space-y-2">
          {data.map((autopost) => (
            <li
              key={autopost.id}
              className="border-border flex items-start gap-3 rounded-lg border p-3"
            >
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">{autopost.title}</p>
                  <span
                    className={
                      autopost.active
                        ? 'bg-success/10 text-success rounded-md px-2 py-0.5 text-xs font-medium'
                        : 'bg-surface-muted text-muted-foreground rounded-md px-2 py-0.5 text-xs font-medium'
                    }
                  >
                    {autopost.active ? 'Active' : 'Paused'}
                  </span>
                </div>
                <p className="text-muted-foreground truncate font-mono text-xs">{autopost.url}</p>
                <p className="text-muted-foreground text-xs">
                  {autopost.integrationIds
                    .map((id) => channelNames.get(id))
                    .filter(Boolean)
                    .join(', ') || 'No channels'}
                  {autopost.lastUrl && ' · last item handled'}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busyId === autopost.id}
                  onClick={() => checkNow(autopost)}
                >
                  {busyId === autopost.id ? 'Checking…' : 'Check now'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busyId === autopost.id}
                  onClick={() => setDialog({ open: true, autopost })}
                >
                  Edit
                </Button>
                <Button
                  variant="danger-ghost"
                  size="sm"
                  disabled={busyId === autopost.id}
                  onClick={() => remove(autopost)}
                >
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <AutopostDialog
        open={dialog.open}
        autopost={dialog.open ? dialog.autopost : null}
        channels={channels}
        aiConfigured={aiConfigured}
        onClose={() => setDialog({ open: false })}
        onSaved={() => {
          setDialog({ open: false });
          void mutate();
        }}
      />
    </Card>
  );
}
