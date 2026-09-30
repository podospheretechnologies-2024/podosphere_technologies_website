'use client';

import { Calendar, ChevronDown, Repeat, Tag } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Modal } from '@/shared/components/ui/modal';
import { cn } from '@/shared/lib/cn';
import { POST_MAX_THREAD_ITEMS, type PostSaveType } from '../../../config/posts';
import { useAiStatus } from '../../../hooks/use-ai-status';
import { useChannels } from '../../../hooks/use-channels';
import { usePostGroup } from '../../../hooks/use-posts';
import { useSignatures } from '../../../hooks/use-settings';
import { splitIntoThread } from '../../../lib/ai.client';
import { nextPostSlot, savePost, toDateTimeLocal } from '../../../lib/posts.client';
import type { AvailableProvider, ChannelItem } from '../../../types/integration';
import type { PostGroup, PostMedia } from '../../../types/post';
import type { SignatureItem, TemplateItem } from '../../../types/settings';
import { ProviderMark } from '../../channels/provider-mark';
import { ChannelSelector } from './channel-selector';
import { PostPreview } from './post-preview';
import { SignatureSelect } from './signature-select';
import { TagPicker } from './tag-picker';
import { TemplateBar } from './template-bar';
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

function withSignature(item: ThreadItemDraft, signature: string): ThreadItemDraft {
  return { ...item, content: `${item.content.trimEnd()}\n\n${signature}` };
}

function toggle(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((entry) => entry !== id) : [...ids, id];
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
  // Signatures are optional: if they fail to load the composer still opens.
  const { data: signatures, error: signaturesError } = useSignatures();
  const loadError = channelsError ?? groupError;

  return (
    <Modal open={open} size="xl" title={group ? 'Edit post' : 'Create Post'} onClose={onClose}>
      {!open ? null : loadError ? (
        <p className="text-danger text-sm">
          {loadError instanceof Error ? loadError.message : 'Could not load the post'}
        </p>
      ) : !channelsData || (group && !groupData) || (!signatures && !signaturesError) ? (
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
          signatures={signatures ?? []}
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
  signatures: SignatureItem[];
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
  signatures,
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
    const [first, ...rest] = initialItems?.length ? initialItems.map(toDraft) : [emptyItem()];
    const autoSignature = signatures.find((signature) => signature.autoAdd);
    return [autoSignature ? withSignature(first, autoSignature.content) : first, ...rest];
  });
  const [tagIds, setTagIds] = useState<string[]>(() => initial?.tags.map((tag) => tag.id) ?? []);
  const [tagsOpen, setTagsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
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
  const selectedChannels = channels.filter((channel) => selectedIds.includes(channel.id));
  const selectedLimits = selectedChannels
    .map((channel) => maxLengthByProvider.get(channel.providerIdentifier))
    .filter((limit): limit is number => limit !== undefined);
  const maxLength = selectedLimits.length ? Math.min(...selectedLimits) : null;
  const channelLimits = selectedChannels.flatMap((channel) => {
    const limit = maxLengthByProvider.get(channel.providerIdentifier);
    if (limit === undefined) {
      return [];
    }
    return [
      {
        id: channel.id,
        name: channel.name,
        providerIdentifier: channel.providerIdentifier,
        providerName: channel.providerName,
        maxLength: limit,
      },
    ];
  });
  const settingsChannel = selectedChannels.length === 1 ? selectedChannels[0] : null;

  function toggleChannel(id: string) {
    setSelectedIds((current) => toggle(current, id));
  }

  function updateItem(updated: ThreadItemDraft) {
    setItems((current) => current.map((item) => (item.key === updated.key ? updated : item)));
  }

  function moveItem(from: number, to: number) {
    setItems((current) => {
      if (to < 0 || to >= current.length) {
        return current;
      }
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  function insertSignature(signature: string) {
    setItems(([first, ...rest]) => [withSignature(first, signature), ...rest]);
  }

  // Channels or media removed since the template was saved are simply left out.
  function applyTemplate(template: TemplateItem) {
    const { content } = template;
    setSelectedIds(
      content.integrationIds.filter((id) => channels.some((channel) => channel.id === id))
    );
    setTagIds(content.tagIds);
    if (content.values.length > 0) {
      setItems(content.values.map(toDraft));
    }
    setError(null);
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
          tagIds,
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
    <div className="flex min-h-0 flex-col gap-4">
      <TemplateBar
        canApply={!group}
        current={{
          integrationIds: selectedIds,
          tagIds,
          values: items.map((item) => ({
            content: item.content,
            mediaIds: item.media.map((media) => media.id),
          })),
        }}
        onApply={applyTemplate}
      />

      <div className="grid min-h-0 gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <div className="space-y-4">
          <ChannelSelector
            channels={channels}
            selectedIds={selectedIds}
            onToggle={toggleChannel}
          />

          <section className="space-y-3">
            <div className="relative space-y-3">
              {items.length > 1 && (
                <div
                  aria-hidden
                  className="bg-border absolute top-6 bottom-6 left-[1.15rem] w-px"
                />
              )}
              {items.map((item, index) => (
                <div key={item.key} className="relative">
                  {items.length > 1 && (
                    <span
                      aria-hidden
                      className="border-border bg-surface absolute top-5 left-3 z-10 size-2.5 -translate-x-1/2 rounded-full border-2"
                    />
                  )}
                  <div className={cn(items.length > 1 && 'pl-6')}>
                    <ThreadItemEditor
                      item={item}
                      index={index}
                      maxLength={maxLength}
                      channelLimits={channelLimits}
                      canMoveUp={index > 0}
                      canMoveDown={index < items.length - 1}
                      onChange={updateItem}
                      onMoveUp={() => moveItem(index, index - 1)}
                      onMoveDown={() => moveItem(index, index + 1)}
                      onRemove={
                        index === 0
                          ? undefined
                          : () =>
                              setItems((current) =>
                                current.filter((entry) => entry.key !== item.key)
                              )
                      }
                    />
                  </div>
                </div>
              ))}
            </div>

            <Button
              variant="ai"
              className="w-full"
              onClick={() => setItems((current) => [...current, emptyItem()])}
              disabled={items.length >= POST_MAX_THREAD_ITEMS || splitting}
            >
              + Add comment / post
            </Button>

            <div className="flex flex-wrap gap-2">
              {aiStatus?.configured && items.length === 1 && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={splitWithAi}
                  disabled={busy || !items[0].content.trim()}
                >
                  {splitting ? 'Splitting…' : 'Split into thread with AI'}
                </Button>
              )}
              <SignatureSelect signatures={signatures} disabled={busy} onInsert={insertSignature} />
            </div>
          </section>

          {settingsChannel && (
            <div>
              <button
                type="button"
                onClick={() => setSettingsOpen((open) => !open)}
                className="bg-primary text-primary-foreground flex w-full items-center gap-2 rounded-lg px-4 py-3 text-left text-sm font-medium"
              >
                <ProviderMark
                  identifier={settingsChannel.providerIdentifier}
                  name={settingsChannel.providerName}
                  size="sm"
                  className="size-5"
                />
                <span className="min-w-0 flex-1 truncate">
                  {settingsChannel.name} Settings
                </span>
                <ChevronDown
                  className={cn('size-4 shrink-0 transition', settingsOpen && 'rotate-180')}
                />
              </button>
              {settingsOpen && (
                <p className="border-border text-muted-foreground mt-2 rounded-lg border px-3 py-2 text-xs">
                  Posts publish with this channel&apos;s connected account settings.
                </p>
              )}
            </div>
          )}
        </div>

        <PostPreview channels={channels} selectedIds={selectedIds} items={items} />
      </div>

      {error && (
        <div
          role="alert"
          className="border-danger/40 bg-danger/10 text-danger rounded-lg border p-3 text-sm"
        >
          {error}
        </div>
      )}

      <div className="border-border flex flex-wrap items-center gap-2 border-t pt-4">
        <div className="relative">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setTagsOpen((open) => !open)}
            aria-expanded={tagsOpen}
          >
            <Tag className="size-3.5" />
            {tagIds.length > 0 ? `Tags (${tagIds.length})` : 'Add New Tag'}
            <ChevronDown className="size-3.5 opacity-70" />
          </Button>
          {tagsOpen && (
            <div className="border-border bg-surface absolute bottom-full left-0 z-20 mb-2 w-72 rounded-xl border p-3 shadow-lg">
              <TagPicker
                selectedIds={tagIds}
                onToggle={(id) => setTagIds((current) => toggle(current, id))}
              />
            </div>
          )}
        </div>

        <Button variant="secondary" size="sm" disabled title="Coming soon">
          <Repeat className="size-3.5" />
          Repeat Post Every…
          <ChevronDown className="size-3.5 opacity-70" />
        </Button>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <label className="border-border bg-surface relative inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-sm">
            <Calendar className="text-muted-foreground size-4 shrink-0" />
            <Input
              id="post-date"
              type="datetime-local"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="h-auto border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
            />
          </label>
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving !== null}>
            Cancel
          </Button>
          <Button variant="secondary" onClick={() => submit('draft')} disabled={busy}>
            {saving === 'draft' ? 'Saving…' : 'Save as draft'}
          </Button>
          <Button variant="ai" onClick={() => submit('now')} disabled={busy}>
            {saving === 'now' ? 'Queuing…' : 'Post now'}
          </Button>
          <Button onClick={() => submit('schedule')} disabled={busy}>
            {saving === 'schedule' ? 'Scheduling…' : group ? 'Update' : 'Add to Calendar'}
          </Button>
        </div>
      </div>
    </div>
  );
}
