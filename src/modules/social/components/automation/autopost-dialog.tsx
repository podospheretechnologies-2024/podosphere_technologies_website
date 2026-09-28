'use client';

import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Modal } from '@/shared/components/ui/modal';
import {
  AUTOPOST_DEFAULT_TEMPLATE,
  AUTOPOST_TEMPLATE_MAX_LENGTH,
  AUTOPOST_TITLE_MAX_LENGTH,
} from '../../config/automation';
import { saveAutopost } from '../../lib/automation.client';
import type { AutopostItem, SaveAutopostInput } from '../../types/automation';
import type { ChannelItem } from '../../types/integration';
import { ChannelSelector } from '../posts/composer/channel-selector';

type AutopostOption = 'onSlot' | 'syncLast' | 'generateContent' | 'addPicture' | 'active';

const OPTIONS: { key: AutopostOption; label: string; hint: string; ai?: boolean }[] = [
  {
    key: 'onSlot',
    label: 'Use posting time slots',
    hint: 'Schedule new items at the next free posting time instead of publishing right away.',
  },
  {
    key: 'syncLast',
    label: 'Post the latest item on the first check',
    hint: 'Otherwise only items added after the feed was saved are posted.',
  },
  {
    key: 'generateContent',
    label: 'Write the post with AI',
    hint: 'The AI writes the text from the item; the link is added at the end.',
    ai: true,
  },
  {
    key: 'addPicture',
    label: 'Add an AI picture',
    hint: 'Generates an image for every item and saves it in the media library.',
    ai: true,
  },
  { key: 'active', label: 'Active', hint: 'Paused feeds are not checked automatically.' },
];

function initialValues(autopost: AutopostItem | null): SaveAutopostInput {
  return {
    title: autopost?.title ?? '',
    url: autopost?.url ?? '',
    content: autopost?.content ?? AUTOPOST_DEFAULT_TEMPLATE,
    integrationIds: autopost?.integrationIds ?? [],
    onSlot: autopost?.onSlot ?? true,
    syncLast: autopost?.syncLast ?? false,
    generateContent: autopost?.generateContent ?? false,
    addPicture: autopost?.addPicture ?? false,
    active: autopost?.active ?? true,
  };
}

interface AutopostDialogProps {
  open: boolean;
  /** Feed being edited, or null to add a new one. */
  autopost: AutopostItem | null;
  channels: ChannelItem[];
  aiConfigured: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function AutopostDialog({
  open,
  autopost,
  channels,
  aiConfigured,
  onClose,
  onSaved,
}: AutopostDialogProps) {
  return (
    <Modal
      open={open}
      size="lg"
      title={autopost ? 'Edit RSS feed' : 'Add RSS feed'}
      description="New items of the feed are turned into posts on the selected channels."
      onClose={onClose}
    >
      {open && (
        <AutopostForm
          key={autopost?.id ?? 'new'}
          autopost={autopost}
          channels={channels}
          aiConfigured={aiConfigured}
          onCancel={onClose}
          onSaved={onSaved}
        />
      )}
    </Modal>
  );
}

interface AutopostFormProps {
  autopost: AutopostItem | null;
  channels: ChannelItem[];
  aiConfigured: boolean;
  onCancel: () => void;
  onSaved: () => void;
}

function AutopostForm({ autopost, channels, aiConfigured, onCancel, onSaved }: AutopostFormProps) {
  const [values, setValues] = useState<SaveAutopostInput>(() => initialValues(autopost));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update(changes: Partial<SaveAutopostInput>) {
    setValues((current) => ({ ...current, ...changes }));
  }

  function toggleChannel(id: string) {
    const { integrationIds } = values;
    update({
      integrationIds: integrationIds.includes(id)
        ? integrationIds.filter((entry) => entry !== id)
        : [...integrationIds, id],
    });
  }

  async function submit() {
    setError(null);
    setSaving(true);
    try {
      await saveAutopost(values, autopost?.id);
      onSaved();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save the feed');
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
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1.5 text-sm font-medium">
          <span>Name</span>
          <Input
            value={values.title}
            onChange={(event) => update({ title: event.target.value })}
            maxLength={AUTOPOST_TITLE_MAX_LENGTH}
            placeholder="e.g. Company blog"
          />
        </label>
        <label className="block space-y-1.5 text-sm font-medium">
          <span>Feed URL</span>
          <Input
            type="url"
            value={values.url}
            onChange={(event) => update({ url: event.target.value })}
            placeholder="https://example.com/feed.xml"
          />
        </label>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Channels</p>
        {channels.length === 0 ? (
          <p className="text-muted-foreground text-sm">Connect a channel first.</p>
        ) : (
          <ChannelSelector
            channels={channels}
            selectedIds={values.integrationIds}
            onToggle={toggleChannel}
          />
        )}
      </div>

      <label className="block space-y-1.5 text-sm font-medium">
        <span>Post template</span>
        <textarea
          value={values.content ?? ''}
          onChange={(event) => update({ content: event.target.value })}
          maxLength={AUTOPOST_TEMPLATE_MAX_LENGTH}
          rows={4}
          disabled={values.generateContent && aiConfigured}
          className="border-border placeholder:text-muted-foreground block w-full resize-y rounded-lg border bg-transparent p-3 font-normal outline-none disabled:opacity-50"
        />
        <span className="text-muted-foreground block text-xs font-normal">
          Placeholders: <code className="font-mono">{'{{title}}'}</code>,{' '}
          <code className="font-mono">{'{{description}}'}</code> and{' '}
          <code className="font-mono">{'{{url}}'}</code>.
          {values.generateContent && aiConfigured && ' Used only if the AI fails.'}
        </span>
      </label>

      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium">Options</legend>
        {OPTIONS.map((option) => {
          const unavailable = option.ai && !aiConfigured;
          return (
            <label key={option.key} className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={values[option.key]}
                disabled={unavailable}
                onChange={(event) => update({ [option.key]: event.target.checked })}
                className="accent-primary mt-0.5 size-4"
              />
              <span className={unavailable ? 'opacity-50' : undefined}>
                {option.label}
                <span className="text-muted-foreground block text-xs">
                  {unavailable ? 'Needs OPENAI_API_KEY in .env.' : option.hint}
                </span>
              </span>
            </label>
          );
        })}
      </fieldset>

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
          disabled={
            saving || !values.title.trim() || !values.url.trim() || !values.integrationIds.length
          }
        >
          {saving ? 'Checking feed…' : 'Save feed'}
        </Button>
      </div>
    </form>
  );
}
