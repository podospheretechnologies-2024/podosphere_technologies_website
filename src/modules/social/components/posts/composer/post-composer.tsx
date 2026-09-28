'use client';

import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Modal } from '@/shared/components/ui/modal';
import { POST_MAX_THREAD_ITEMS, type PostSaveType } from '../../../config/posts';
import { useAiStatus } from '../../../hooks/use-ai-status';
import { useChannels } from '../../../hooks/use-channels';
import { usePostGroup } from '../../../hooks/use-posts';
import { splitIntoThread } from '../../../lib/ai.client';
import { nextPostSlot, savePost, toDateTimeLocal } from '../../../lib/posts.client';
import type { AvailableProvider, ChannelItem } from '../../../types/integration';
import type { PostGroup, PostMedia } from '../../../types/post';
import { ChannelSelector } from './channel-selector';
import { ThreadItemEditor, type ThreadItemDraft } from './thread-item-editor';

export interface ComposerInitialItem {
  content: string;
  media: PostMedia[];
}

interface PostComposerProps {
  open: boolean;
  /** Group id of the post being edited, or null to create a new post. */
  group: string | null;
  /** Pre-filled publish date for new posts (datetime-local value). */
  defaultDate?: string;
  /** Pre-filled thread for new posts, e.g. a variation from the AI Studio. */
  initialItems?: ComposerInitialItem[];
  onClose: () => void;
  onSaved: () => void;
}

function emptyItem(): ThreadItemDraft {
  return { key: crypto.randomUUID(), content: '', media: [], delay: 0 };
}

function toDraft(item: ComposerInitialItem): ThreadItemDraft {
  return { ...item, key: crypto.randomUUID(), delay: 0 };
}

export function PostComposer({
  open,
  group,
  defaultDate,
  initialItems,
  onClose,
  onSaved,
}: PostComposerProps) {
  const { data: channelsData, error: channelsError } = useChannels();
  const { data: groupData, error: groupError } = usePostGroup(open ? group : null);
  const loadError = channelsError ?? groupError;

  return (
    <Modal open={open} size="lg" title={group ? 'Edit post' : 'Create post'} onClose={onClose}>
      {!open ? null : loadError ? (
        <p className="text-danger text-sm">
          {loadError instanceof Error ? loadError.message : 'Could not load the post'}
        </p>
      ) : !channelsData || (group && !groupData) ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : (
        <ComposerForm
          key={group ?? 'new'}
          group={group}
          initial={groupData}
          defaultDate={defaultDate}
          initialItems={initialItems}
          channels={channelsData.channels}
          providers={channelsData.providers}
          onCancel={onClose}
          onSaved={onSaved}
        />
      )}
    </Modal>
  );
}

interface ComposerFormProps {
  group: string | null;
  initial?: PostGroup;
  defaultDate?: string;
  initialItems?: ComposerInitialItem[];
  channels: ChannelItem[];
  providers: AvailableProvider[];
  onCancel: () => void;
  onSaved: () => void;
}

function ComposerForm({
  group,
  initial,
  defaultDate,
  initialItems,
  channels,
  providers,
  onCancel,
  onSaved,
}: ComposerFormProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>(() =>
    (initial?.posts ?? [])
      .map((post) => post.channel.id)
      .filter((id) => channels.some((channel) => channel.id === id))
  );
  // The composer edits one shared thread for every selected channel.
  const [items, setItems] = useState<ThreadItemDraft[]>(() => {
    if (initial?.posts[0]) {
      return initial.posts[0].values.map((value) => ({ ...value, key: crypto.randomUUID() }));
    }
    return initialItems?.length ? initialItems.map(toDraft) : [emptyItem()];
  });
  const [date, setDate] = useState(() =>
    initial ? toDateTimeLocal(initial.publishDate) : (defaultDate ?? nextPostSlot())
  );
  const [saving, setSaving] = useState<PostSaveType | null>(null);
  const [splitting, setSplitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data: aiStatus } = useAiStatus();
  const busy = saving !== null || splitting;

  const maxLengthByProvider = new Map(
    providers.map((provider) => [provider.identifier, provider.maxLength])
  );
  const selectedLimits = channels
    .filter((channel) => selectedIds.includes(channel.id))
    .map((channel) => maxLengthByProvider.get(channel.providerIdentifier))
    .filter((limit): limit is number => limit !== undefined);
  const maxLength = selectedLimits.length ? Math.min(...selectedLimits) : null;

  function toggleChannel(id: string) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]
    );
  }

  function updateItem(updated: ThreadItemDraft) {
    setItems((current) => current.map((item) => (item.key === updated.key ? updated : item)));
  }

  // The media of the original post stays on the first item of the thread.
  async function splitWithAi() {
    if (maxLength === null) {
      setError('Select a channel first so the AI knows the length limit');
      return;
    }

    const [first] = items;
    setError(null);
    setSplitting(true);
    try {
      const { posts } = await splitIntoThread({ content: first.content, maxLength });
      setItems(
        posts.map((content, index) => toDraft({ content, media: index === 0 ? first.media : [] }))
      );
    } catch (splitError) {
      setError(splitError instanceof Error ? splitError.message : 'Could not split the post');
    } finally {
      setSplitting(false);
    }
  }

  async function submit(type: PostSaveType) {
    if (selectedIds.length === 0) {
      setError('Select at least one channel');
      return;
    }
    if (type !== 'now' && !date) {
      setError('Pick a date and time');
      return;
    }

    setError(null);
    setSaving(type);
    try {
      await savePost(
        {
          type,
          date: new Date(date || Date.now()).toISOString(),
          posts: selectedIds.map((integrationId) => ({
            integrationId,
            values: items.map((item) => ({
              content: item.content,
              mediaIds: item.media.map((media) => media.id),
              delay: item.delay,
            })),
          })),
        },
        group ?? undefined
      );
      onSaved();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save the post');
      setSaving(null);
    }
  }

  if (channels.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Connect a channel on the Channels page before creating posts.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <h3 className="text-sm font-medium">Channels</h3>
        <ChannelSelector channels={channels} selectedIds={selectedIds} onToggle={toggleChannel} />
      </section>

      <section className="space-y-3">
        {items.map((item, index) => (
          <ThreadItemEditor
            key={item.key}
            item={item}
            index={index}
            maxLength={maxLength}
            onChange={updateItem}
            onRemove={
              index === 0
                ? undefined
                : () => setItems((current) => current.filter((entry) => entry.key !== item.key))
            }
          />
        ))}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setItems((current) => [...current, emptyItem()])}
            disabled={items.length >= POST_MAX_THREAD_ITEMS || splitting}
          >
            Add comment
          </Button>
          {aiStatus?.configured && items.length === 1 && (
            <Button
              variant="ai"
              size="sm"
              onClick={splitWithAi}
              disabled={busy || !items[0].content.trim()}
            >
              {splitting ? 'Splitting…' : 'Split into thread with AI'}
            </Button>
          )}
        </div>
      </section>

      <section className="space-y-2">
        <label htmlFor="post-date" className="text-sm font-medium">
          Publish date
        </label>
        <Input
          id="post-date"
          type="datetime-local"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          className="max-w-xs"
        />
      </section>

      {error && (
        <div
          role="alert"
          className="border-danger/40 bg-danger/10 text-danger rounded-lg border p-3 text-sm"
        >
          {error}
        </div>
      )}

      <div className="border-border flex flex-wrap items-center justify-end gap-2 border-t pt-4">
        <Button variant="ghost" onClick={onCancel} disabled={saving !== null} className="mr-auto">
          Cancel
        </Button>
        <Button variant="secondary" onClick={() => submit('draft')} disabled={busy}>
          {saving === 'draft' ? 'Saving…' : 'Save as draft'}
        </Button>
        <Button variant="secondary" onClick={() => submit('now')} disabled={busy}>
          {saving === 'now' ? 'Queuing…' : 'Post now'}
        </Button>
        <Button onClick={() => submit('schedule')} disabled={busy}>
          {saving === 'schedule' ? 'Scheduling…' : group ? 'Update schedule' : 'Schedule'}
        </Button>
      </div>
    </div>
  );
}
