'use client';

import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Modal } from '@/shared/components/ui/modal';
import { WEBHOOK_NAME_MAX_LENGTH } from '../../config/automation';
import { saveWebhook } from '../../lib/automation.client';
import type { WebhookItem } from '../../types/automation';
import type { ChannelItem } from '../../types/integration';
import { ChannelSelector } from '../posts/composer/channel-selector';

interface WebhookDialogProps {
  open: boolean;
  /** Webhook being edited, or null to add a new one. */
  webhook: WebhookItem | null;
  channels: ChannelItem[];
  onClose: () => void;
  onSaved: () => void;
}

export function WebhookDialog({ open, webhook, channels, onClose, onSaved }: WebhookDialogProps) {
  return (
    <Modal
      open={open}
      title={webhook ? 'Edit webhook' : 'Add webhook'}
      description="We send a POST request with the post details every time a post is published on one of the selected channels."
      onClose={onClose}
    >
      {open && (
        <WebhookForm
          key={webhook?.id ?? 'new'}
          webhook={webhook}
          channels={channels}
          onCancel={onClose}
          onSaved={onSaved}
        />
      )}
    </Modal>
  );
}

interface WebhookFormProps {
  webhook: WebhookItem | null;
  channels: ChannelItem[];
  onCancel: () => void;
  onSaved: () => void;
}

function WebhookForm({ webhook, channels, onCancel, onSaved }: WebhookFormProps) {
  const [name, setName] = useState(webhook?.name ?? '');
  const [url, setUrl] = useState(webhook?.url ?? '');
  const [integrationIds, setIntegrationIds] = useState<string[]>(webhook?.integrationIds ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleChannel(id: string) {
    setIntegrationIds((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]
    );
  }

  async function submit() {
    setError(null);
    setSaving(true);
    try {
      await saveWebhook({ name, url, integrationIds }, webhook?.id);
      onSaved();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save the webhook');
      setSaving(false);
    }
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <label className="block space-y-1.5 text-sm font-medium">
        <span>Name</span>
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={WEBHOOK_NAME_MAX_LENGTH}
          placeholder="e.g. Zapier"
        />
      </label>
      <label className="block space-y-1.5 text-sm font-medium">
        <span>URL</span>
        <Input
          type="url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://hooks.example.com/…"
        />
      </label>
      <div className="space-y-2">
        <p className="text-sm font-medium">Channels</p>
        {channels.length === 0 ? (
          <p className="text-muted-foreground text-sm">Connect a channel first.</p>
        ) : (
          <ChannelSelector
            channels={channels}
            selectedIds={integrationIds}
            onToggle={toggleChannel}
          />
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="border-danger/40 bg-danger/10 text-danger rounded-lg border p-3 text-sm"
        >
          {error}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={saving || !name.trim() || !url.trim() || integrationIds.length === 0}
        >
          {saving ? 'Saving…' : 'Save webhook'}
        </Button>
      </div>
    </form>
  );
}
