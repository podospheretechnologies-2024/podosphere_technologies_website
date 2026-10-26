'use client';

import { Calendar, ChevronDown, Clock, Repeat, Sparkles, Tag } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Modal } from '@/shared/components/ui/modal';
import { cn } from '@/shared/lib/cn';
import { AI_PROMPT_MAX_LENGTH } from '../../../config/ai';
import {
  POST_CONTENT_MAX_LENGTH,
  POST_MAX_THREAD_ITEMS,
  RECURRENCE_RULE_LABELS,
  type PostSaveType,
} from '../../../config/posts';
import { useAiStatus } from '../../../hooks/use-ai-status';
import { useBestTimes } from '../../../hooks/use-best-times';
import { useChannels } from '../../../hooks/use-channels';
import { usePostGroup } from '../../../hooks/use-posts';
import { useHashtagGroups, useSignatures } from '../../../hooks/use-settings';
import { generatePosts, splitIntoThread } from '../../../lib/ai.client';
import { fetchGoogleSheetsContent } from '../../../lib/google-sheets.client';
import {
  nextPostSlot,
  nextSlotDateTimeLocal,
  savePost,
  toDateTimeLocal,
} from '../../../lib/posts.client';
import type { CaptionTonePresetId } from '../../../server/ai/presets';
import type { AvailableProvider, ChannelItem } from '../../../types/integration';
import type { PostGroup, PostMedia } from '../../../types/post';
import type { SignatureItem, TemplateItem } from '../../../types/settings';
import { CaptionTonePicker } from '../../ai/caption-tone-picker';
import { ProviderMark } from '../../channels/provider-mark';
import { ChannelSelector, relatedChannels } from './channel-selector';
import { HashtagSelect } from './hashtag-select';
import { PostPreview } from './post-preview';
import {
  RecurrencePicker,
  recurrenceDraftToPayload,
  toRecurrenceDraft,
  type RecurrenceDraft,
} from './recurrence-picker';
import { SignatureSelect } from './signature-select';
import { TagPicker } from './tag-picker';
import { TemplateBar } from './template-bar';
import { ThreadItemEditor, type ThreadItemDraft } from './thread-item-editor';
import { UtmShortLink } from './utm-short-link';

/** Providers that post an optional first comment after the main publish. */
const FIRST_COMMENT_PROVIDERS = new Set(['facebook', 'instagram', 'linkedin']);

function initialFirstComment(posts: PostGroup['posts'] | undefined): string {
  if (!posts?.length) return '';
  const ig = posts.find((post) => post.channel.providerIdentifier === 'instagram');
  if (ig?.firstComment) return ig.firstComment;
  return posts.find((post) => post.firstComment)?.firstComment ?? '';
}

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
          key={
            group ??
            `new:${defaultDate ?? ''}:${initialItems?.[0]?.content?.slice(0, 64) ?? ''}`
          }
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
  // Optional: if hashtag groups fail to load the composer still works.
  const { data: hashtagGroups } = useHashtagGroups();
  const [firstComment, setFirstComment] = useState(() => initialFirstComment(initial?.posts));
  const [recurrence, setRecurrence] = useState<RecurrenceDraft>(() =>
    toRecurrenceDraft(initial?.recurrence)
  );
  const [tagsOpen, setTagsOpen] = useState(false);
  const [recurrenceOpen, setRecurrenceOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [date, setDate] = useState(() =>
    initial ? toDateTimeLocal(initial.publishDate) : (defaultDate ?? nextPostSlot())
  );
  const [saving, setSaving] = useState<PostSaveType | null>(null);
  const [splitting, setSplitting] = useState(false);
  const [aiDraftOpen, setAiDraftOpen] = useState(false);
  const [aiIdea, setAiIdea] = useState('');
  const [tonePresetId, setTonePresetId] = useState<CaptionTonePresetId | null>(null);
  const [generatingAi, setGeneratingAi] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data: aiStatus } = useAiStatus();
  const busy = saving !== null || splitting || generatingAi;
  const lastSheetAutoContentRef = useRef<string | null>(null);
  const skipSheetAuto = Boolean(group || initialItems?.length);
  const bestTimesChannelId = selectedIds[0] ?? null;
  const { data: bestTimes } = useBestTimes(bestTimesChannelId);
  const suggestedSlot = bestTimes?.suggested[0] ?? null;

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
  const supportsFirstComment = selectedChannels.some((channel) =>
    FIRST_COMMENT_PROVIDERS.has(channel.providerIdentifier)
  );
  const hasInstagram = selectedChannels.some(
    (channel) => channel.providerIdentifier === 'instagram'
  );

  function toggleChannel(id: string) {
    setSelectedIds((current) => {
      const channel = channels.find((entry) => entry.id === id);
      if (!channel) {
        return toggle(current, id);
      }

      // Already selected → remove only this channel (cross / second click).
      if (current.includes(id)) {
        return current.filter((entryId) => entryId !== id);
      }

      // Selecting one channel also selects its Instagram / Facebook / LinkedIn / etc.
      const groupIds = relatedChannels(channels, channel)
        .filter((entry) => !entry.disabled && !entry.refreshNeeded)
        .map((entry) => entry.id);
      return [...new Set([...current, ...groupIds])];
    });
  }

  function updateItem(updated: ThreadItemDraft) {
    setItems((current) => current.map((item) => (item.key === updated.key ? updated : item)));
  }

  // Auto-fill the first post body from Google Sheets when the schedule date changes.
  useEffect(() => {
    if (skipSheetAuto || !open || !date) return;
    const day = date.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return;

    let cancelled = false;
    fetchGoogleSheetsContent(day)
      .then((match) => {
        if (cancelled || !match.row?.content.trim()) return;
        const content = match.row.content.trim();
        setItems((current) => {
          const [first, ...rest] = current;
          if (!first) return current;
          const currentText = first.content.trim();
          const previousAuto = lastSheetAutoContentRef.current;
          if (currentText && previousAuto === null) {
            return current;
          }
          if (currentText && previousAuto !== null && currentText !== previousAuto) {
            return current;
          }
          lastSheetAutoContentRef.current = content;
          return [{ ...first, content }, ...rest];
        });
      })
      .catch(() => {
        // Sheets not connected — ignore silently in composer.
      });

    return () => {
      cancelled = true;
    };
  }, [date, open, skipSheetAuto]);

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

  function insertHashtags(hashtags: string) {
    setItems(([first, ...rest]) => {
      if (!first) return [{ ...emptyItem(), content: hashtags }, ...rest];
      const content = first.content.trim()
        ? `${first.content.trimEnd()}\n\n${hashtags}`
        : hashtags;
      return [{ ...first, content }, ...rest];
    });
  }

  function insertShortLink(shortUrl: string) {
    setItems(([first, ...rest]) => {
      if (!first) return [{ ...emptyItem(), content: shortUrl }, ...rest];
      const content = first.content.trim()
        ? `${first.content.trimEnd()}\n${shortUrl}`
        : shortUrl;
      return [{ ...first, content }, ...rest];
    });
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

  async function writeWithAi() {
    const idea = aiIdea.trim() || items[0]?.content.trim();
    if (!idea) {
      setError('Describe what the post should be about');
      return;
    }
    setError(null);
    setGeneratingAi(true);
    try {
      const result = await generatePosts({
        content: idea,
        format: 'post',
        maxLength: maxLength ?? undefined,
        tonePresetId: tonePresetId ?? undefined,
      });
      const posts = result.variations[0] ?? [];
      const content = posts[0]?.trim();
      if (!content) {
        throw new Error('The AI did not return a usable post. Try again.');
      }
      setItems(([first, ...rest]) => [{ ...first, content }, ...rest]);
      setAiDraftOpen(false);
    } catch (writeError) {
      setError(writeError instanceof Error ? writeError.message : 'Could not write the post');
    } finally {
      setGeneratingAi(false);
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
          recurrence: recurrenceDraftToPayload(recurrence),
          posts: selectedIds.map((integrationId) => {
            const channel = channels.find((entry) => entry.id === integrationId);
            const canComment =
              channel && FIRST_COMMENT_PROVIDERS.has(channel.providerIdentifier);
            return {
              integrationId,
              firstComment: canComment ? firstComment : '',
              values: items.map((item) => ({
                content: item.content,
                mediaIds: item.media.map((media) => media.id),
                delay: item.delay,
              })),
            };
          }),
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
                      postDate={date}
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
              {aiStatus?.configured && (
                <Button
                  variant="ai"
                  size="sm"
                  onClick={() => {
                    setAiDraftOpen((open) => !open);
                    if (!aiIdea.trim() && items[0]?.content.trim()) {
                      setAiIdea(items[0].content);
                    }
                  }}
                  disabled={busy}
                >
                  <Sparkles className="size-3.5" />
                  {aiDraftOpen ? 'Hide AI draft' : 'Start from preset'}
                </Button>
              )}
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
              <HashtagSelect
                groups={hashtagGroups ?? []}
                disabled={busy}
                onInsert={insertHashtags}
              />
              <UtmShortLink
                channels={selectedChannels}
                disabled={busy}
                onInsert={insertShortLink}
              />
            </div>

            {aiDraftOpen && aiStatus?.configured && (
              <div className="border-border bg-surface-muted/30 space-y-3 rounded-xl border p-3">
                <CaptionTonePicker
                  value={tonePresetId}
                  onChange={setTonePresetId}
                  disabled={generatingAi}
                />
                <textarea
                  value={aiIdea}
                  onChange={(event) => setAiIdea(event.target.value)}
                  maxLength={AI_PROMPT_MAX_LENGTH}
                  rows={3}
                  placeholder="Idea or festival topic — AI will draft the first post…"
                  aria-label="AI draft idea"
                  disabled={generatingAi}
                  className="border-border placeholder:text-muted-foreground block w-full resize-y rounded-lg border bg-transparent p-3 text-sm outline-none"
                />
                <Button
                  variant="ai"
                  size="sm"
                  onClick={() => void writeWithAi()}
                  disabled={
                    generatingAi || (!aiIdea.trim() && !items[0]?.content.trim())
                  }
                >
                  {generatingAi ? 'Writing…' : 'Generate into post'}
                </Button>
              </div>
            )}

            {supportsFirstComment && (
              <label className="border-border bg-surface block space-y-1.5 rounded-lg border p-3">
                <span className="text-sm font-medium">
                  First comment{hasInstagram ? ' (Instagram hashtags)' : ''}
                </span>
                <textarea
                  value={firstComment}
                  onChange={(event) => setFirstComment(event.target.value)}
                  disabled={busy}
                  rows={3}
                  maxLength={POST_CONTENT_MAX_LENGTH}
                  placeholder={
                    hasInstagram
                      ? '#brand #campaign — posted as the first comment after publish'
                      : 'Posted as the first comment after the main post goes live'
                  }
                  className="border-border bg-background placeholder:text-muted-foreground focus-visible:ring-ring w-full resize-y rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-2"
                />
                <span className="text-muted-foreground block text-xs">
                  Facebook, Instagram, and LinkedIn only. Useful for keeping hashtags out of the
                  caption.
                </span>
              </label>
            )}
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
                <div className="border-border mt-2 space-y-2 rounded-lg border px-3 py-2 text-xs">
                  <p className="text-muted-foreground">
                    Posts publish with this channel&apos;s connected account settings.
                  </p>
                  {FIRST_COMMENT_PROVIDERS.has(settingsChannel.providerIdentifier) && (
                    <label className="block space-y-1.5">
                      <span className="text-foreground font-medium">
                        {settingsChannel.providerIdentifier === 'instagram'
                          ? 'First comment (hashtags)'
                          : 'First comment'}
                      </span>
                      <textarea
                        value={firstComment}
                        onChange={(event) => setFirstComment(event.target.value)}
                        disabled={busy}
                        rows={3}
                        maxLength={POST_CONTENT_MAX_LENGTH}
                        placeholder="Optional comment posted right after publish"
                        className="border-border bg-background placeholder:text-muted-foreground focus-visible:ring-ring w-full resize-y rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-2"
                      />
                    </label>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <PostPreview
          channels={channels}
          selectedIds={selectedIds}
          items={items}
          onSelectedIdsChange={setSelectedIds}
        />
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
            onClick={() => {
              setTagsOpen((open) => !open);
              setRecurrenceOpen(false);
            }}
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

        <div className="relative">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setRecurrenceOpen((open) => !open);
              setTagsOpen(false);
            }}
            aria-expanded={recurrenceOpen}
          >
            <Repeat className="size-3.5" />
            {recurrence ? RECURRENCE_RULE_LABELS[recurrence.rule] : 'Repeat Post Every…'}
            <ChevronDown className="size-3.5 opacity-70" />
          </Button>
          {recurrenceOpen && (
            <div className="border-border bg-surface absolute bottom-full left-0 z-20 mb-2 w-80 rounded-xl border p-3 shadow-lg">
              <RecurrencePicker
                value={recurrence}
                onChange={(next) => {
                  setRecurrence(next);
                  if (next === null) setRecurrenceOpen(false);
                }}
              />
            </div>
          )}
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {suggestedSlot ? (
            <Button
              variant="secondary"
              size="sm"
              type="button"
              title={`Based on ${bestTimes?.channelName ?? 'channel'} history`}
              onClick={() => setDate(nextSlotDateTimeLocal(suggestedSlot.weekday, suggestedSlot.hour))}
              disabled={busy}
            >
              <Clock className="size-3.5" />
              Suggested: {suggestedSlot.label}
            </Button>
          ) : null}
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
