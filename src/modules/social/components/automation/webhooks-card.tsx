'use client';

import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { useWebhooks } from '../../hooks/use-automation';
import { deleteWebhook, testWebhook } from '../../lib/automation.client';
import type { WebhookItem } from '../../types/automation';
import type { ChannelItem } from '../../types/integration';
import { WebhookDialog } from './webhook-dialog';

type DialogState = { open: false } | { open: true; webhook: WebhookItem | null };

interface WebhooksCardProps {
  channels: ChannelItem[];
}

export function WebhooksCard({ channels }: WebhooksCardProps) {
  const { data, error, mutate } = useWebhooks();
  const [dialog, setDialog] = useState<DialogState>({ open: false });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const channelNames = new Map(channels.map((channel) => [channel.id, channel.name]));

  async function runAction(webhook: WebhookItem, action: () => Promise<void>) {
    setActionError(null);
    setNotice(null);
    setBusyId(webhook.id);
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

  function test(webhook: WebhookItem) {
    return runAction(webhook, async () => {
      const { status } = await testWebhook(webhook.id);
      const ok = status >= 200 && status < 300;
      if (ok) {
        setNotice(`${webhook.name} answered with HTTP ${status}.`);
      } else {
        setActionError(`${webhook.name} answered with HTTP ${status}.`);
      }
    });
  }

  function remove(webhook: WebhookItem) {
    if (!window.confirm(`Delete the webhook "${webhook.name}"?`)) {
      return;
    }
    return runAction(webhook, async () => {
      await deleteWebhook(webhook.id);
      await mutate();
    });
  }

  return (
    <Card className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Webhooks</h2>
          <p className="text-muted-foreground text-sm">
            Notify another app (Zapier, Make, your own API) when a post is published.
          </p>
        </div>
        <Button size="sm" onClick={() => setDialog({ open: true, webhook: null })}>
          Add webhook
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
          {error instanceof Error ? error.message : 'Could not load webhooks'}
        </p>
      ) : !data ? (
        <p className="text-muted-foreground text-sm">Loading webhooks…</p>
      ) : data.length === 0 ? (
        <p className="text-muted-foreground text-sm">No webhooks yet.</p>
      ) : (
        <ul className="space-y-2">
          {data.map((webhook) => (
            <li
              key={webhook.id}
              className="border-border flex items-start gap-3 rounded-lg border p-3"
            >
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-sm font-medium">{webhook.name}</p>
                <p className="text-muted-foreground truncate font-mono text-xs">{webhook.url}</p>
                <p className="text-muted-foreground text-xs">
                  {webhook.integrationIds
                    .map((id) => channelNames.get(id))
                    .filter(Boolean)
                    .join(', ') || 'No channels'}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busyId === webhook.id}
                  onClick={() => test(webhook)}
                >
                  {busyId === webhook.id ? 'Sending…' : 'Test'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busyId === webhook.id}
                  onClick={() => setDialog({ open: true, webhook })}
                >
                  Edit
                </Button>
                <Button
                  variant="danger-ghost"
                  size="sm"
                  disabled={busyId === webhook.id}
                  onClick={() => remove(webhook)}
                >
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <WebhookDialog
        open={dialog.open}
        webhook={dialog.open ? dialog.webhook : null}
        channels={channels}
        onClose={() => setDialog({ open: false })}
        onSaved={() => {
          setDialog({ open: false });
          void mutate();
        }}
      />
    </Card>
  );
}
