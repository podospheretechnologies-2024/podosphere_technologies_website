'use client';

import {
  BadgeCheck,
  Globe,
  Heart,
  Info,
  MessageCircle,
  Repeat2,
  Send,
  ThumbsUp,
} from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';
import type { MediaFormat } from '../../../config/media';
import type { ChannelItem } from '../../../types/integration';
import type { MediaItem } from '../../../types/media';
import type { PostMedia } from '../../../types/post';
import { ChannelAvatar } from '../../channels/channel-avatar';
import { ProviderMark } from '../../channels/provider-mark';
import { InstagramFrame } from '../../media/instagram-frames';
import type { ThreadItemDraft } from './thread-item-editor';

const GLOBAL_EDIT_INFO =
  'Global Edit means this post uses one shared caption and media for every channel shown in this row. Those channels stay selected together by default. You can click a channel to remove it from this post, or click Global Edit again to select all of them. Global Edit stays highlighted only when every channel in this row is selected.';

interface PostPreviewProps {
  channels: ChannelItem[];
  selectedIds: string[];
  items: ThreadItemDraft[];
  onSelectedIdsChange?: (ids: string[]) => void;
}

export function PostPreview({
  channels,
  selectedIds,
  items,
  onSelectedIdsChange,
}: PostPreviewProps) {
  const selected = channels.filter((channel) => selectedIds.includes(channel.id));
  const main = items[0];
  const comments = items.slice(1);
  const hasMedia = (main?.media.length ?? 0) > 0;

  // Channels available in this preview row = the ones you already picked (e.g. podocrm IG + FB).
  // Kept even if you temporarily deselect one so you can turn it back on.
  const [barIds, setBarIds] = useState<string[]>([]);
  const [focusId, setFocusId] = useState<string>('');
  const [infoOpen, setInfoOpen] = useState(false);
  const prevHasMedia = useRef(false);

  useEffect(() => {
    if (!hasMedia) {
      setBarIds([]);
      prevHasMedia.current = false;
      return;
    }

    if (!prevHasMedia.current) {
      // Media just added: lock the row to currently selected channels (not every connected account).
      setBarIds(selectedIds);
      setFocusId(selectedIds.length > 1 ? 'global' : (selectedIds[0] ?? ''));
      prevHasMedia.current = true;
      return;
    }

    // If more channels are picked on the left later, add them to this row.
    setBarIds((current) => {
      let changed = false;
      const next = [...current];
      for (const id of selectedIds) {
        if (!next.includes(id)) {
          next.push(id);
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [hasMedia, selectedIds]);

  const barChannels = channels.filter((channel) => barIds.includes(channel.id));
  const allSelected =
    barChannels.length > 0 && barChannels.every((channel) => selectedIds.includes(channel.id));
  const showPreviewBar = hasMedia && barChannels.length > 0;

  useEffect(() => {
    if (selected.length === 0) {
      setFocusId('');
      return;
    }
    if (allSelected && barChannels.length > 1) {
      setFocusId('global');
      return;
    }
    if (focusId === 'global' || !selected.some((channel) => channel.id === focusId)) {
      setFocusId(selected[0].id);
    }
  }, [selected, allSelected, barChannels.length, focusId]);

  const previewChannel =
    focusId === 'global'
      ? selected[0]
      : (selected.find((channel) => channel.id === focusId) ?? selected[0]);
  const showGlobal = selected.length > 1 && allSelected && focusId === 'global';
  const format = mediaFormat(main?.media ?? []);
  // Story / Reel must use the platform frame preview even in Global Edit.
  const useFormatPreview =
    Boolean(previewChannel) && (format === 'story' || format === 'reel' || !showGlobal);

  function selectAllInBar() {
    if (!onSelectedIdsChange || barIds.length === 0) {
      setFocusId(barIds.length > 1 ? 'global' : (barIds[0] ?? ''));
      return;
    }
    // Keep any other selected ids outside this bar, and turn every bar channel on.
    const outside = selectedIds.filter((id) => !barIds.includes(id));
    onSelectedIdsChange([...outside, ...barIds]);
    setFocusId(barIds.length > 1 ? 'global' : barIds[0]);
  }

  function togglePreviewChannel(id: string) {
    if (!onSelectedIdsChange) {
      setFocusId(id);
      return;
    }
    const next = selectedIds.includes(id)
      ? selectedIds.filter((entry) => entry !== id)
      : [...selectedIds, id];
    onSelectedIdsChange(next);

    const nextInBar = barIds.filter((entry) => next.includes(entry));
    if (nextInBar.length === 0) {
      setFocusId('');
    } else if (nextInBar.length === barIds.length && barIds.length > 1) {
      setFocusId('global');
    } else if (next.includes(id)) {
      setFocusId(id);
    } else {
      setFocusId(nextInBar[0]);
    }
  }

  if (!previewChannel) {
    return (
      <div className="flex h-full min-h-72 flex-col">
        <h3 className="mb-4 text-lg font-semibold">Post Preview</h3>
        {showPreviewBar && (
          <PreviewChannelBar
            channels={barChannels}
            selectedIds={selectedIds}
            allSelected={allSelected}
            infoOpen={infoOpen}
            onToggleInfo={() => setInfoOpen((open) => !open)}
            onSelectAll={selectAllInBar}
            onToggleChannel={togglePreviewChannel}
          />
        )}
        <div className="border-border bg-surface-muted/40 text-muted-foreground flex flex-1 items-center justify-center rounded-xl border border-dashed p-6 text-center text-sm">
          Select a channel to preview your post
        </div>
      </div>
    );
  }

  if (!main?.content.trim() && main.media.length === 0) {
    return (
      <div className="flex h-full min-h-72 flex-col">
        <h3 className="mb-4 text-lg font-semibold">Post Preview</h3>
        <div className="border-border bg-surface-muted/40 text-muted-foreground flex flex-1 items-center justify-center rounded-xl border border-dashed p-6 text-center text-sm">
          Start writing your post
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-3 flex shrink-0 items-center justify-between gap-2">
        <h3 className="text-lg font-semibold">Post Preview</h3>
        {main.media.length > 0 && (
          <span className="text-muted-foreground rounded-full border border-border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide uppercase">
            {format}
          </span>
        )}
      </div>

      {showPreviewBar && (
        <PreviewChannelBar
          channels={barChannels}
          selectedIds={selectedIds}
          allSelected={allSelected}
          infoOpen={infoOpen}
          onToggleInfo={() => setInfoOpen((open) => !open)}
          onSelectAll={selectAllInBar}
          onToggleChannel={togglePreviewChannel}
        />
      )}

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {!useFormatPreview ? (
          <GlobalEditPreview channel={previewChannel} items={items} />
        ) : previewChannel.providerIdentifier === 'instagram' ? (
          <InstagramLivePreview
            key={`ig-${format}-${main.media[0]?.id ?? 'none'}`}
            channel={previewChannel}
            main={main}
            comments={comments}
          />
        ) : previewChannel.providerIdentifier === 'facebook' ? (
          <FacebookLivePreview
            key={`fb-${format}-${main.media[0]?.id ?? 'none'}`}
            channel={previewChannel}
            main={main}
            comments={comments}
          />
        ) : previewChannel.providerIdentifier === 'linkedin' ? (
          <LinkedInPreview
            key={`li-${format}-${main.media[0]?.id ?? 'none'}`}
            channel={previewChannel}
            main={main}
            comments={comments}
          />
        ) : (
          <GlobalEditPreview channel={previewChannel} items={items} />
        )}
      </div>

      {selected.length > 1 && (
        <p className="text-muted-foreground mt-3 shrink-0 text-xs">
          Will publish to all {selected.length} selected channels.
        </p>
      )}
    </div>
  );
}

function PreviewChannelBar({
  channels,
  selectedIds,
  allSelected,
  infoOpen,
  onToggleInfo,
  onSelectAll,
  onToggleChannel,
}: {
  channels: ChannelItem[];
  selectedIds: string[];
  allSelected: boolean;
  infoOpen: boolean;
  onToggleInfo: () => void;
  onSelectAll: () => void;
  onToggleChannel: (id: string) => void;
}) {
  return (
    <div className="mb-3 space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
          {channels.map((channel) => {
            const isOn = selectedIds.includes(channel.id);
            return (
              <button
                key={channel.id}
                type="button"
                onClick={() => onToggleChannel(channel.id)}
                aria-pressed={isOn}
                className={cn(
                  'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition',
                  isOn
                    ? 'border-primary bg-primary/15 text-foreground'
                    : 'border-border text-muted-foreground hover:bg-surface-muted'
                )}
              >
                <ProviderMark
                  identifier={channel.providerIdentifier}
                  name={channel.providerName}
                  size="sm"
                  className="size-3.5"
                />
                <span className="max-w-28 truncate">{channel.name}</span>
              </button>
            );
          })}
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onSelectAll}
            aria-pressed={allSelected}
            className={cn(
              'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition',
              allSelected
                ? 'border-primary bg-primary/15 text-foreground'
                : 'border-border text-muted-foreground hover:bg-surface-muted'
            )}
          >
            <Globe className="size-3.5" />
            Global Edit
          </button>
          <button
            type="button"
            onClick={onToggleInfo}
            aria-expanded={infoOpen}
            aria-label="What is Global Edit?"
            className={cn(
              'inline-flex size-7 items-center justify-center rounded-full transition',
              infoOpen
                ? 'bg-primary/15 text-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-surface-muted'
            )}
          >
            <Info className="size-3.5" />
          </button>
        </div>
      </div>

      {infoOpen && (
        <p className="border-border bg-surface-muted/40 text-muted-foreground rounded-lg border px-3 py-2 text-xs leading-relaxed">
          {GLOBAL_EDIT_INFO}
        </p>
      )}
    </div>
  );
}

function mediaFormat(media: PostMedia[]): MediaFormat {
  return media[0]?.format ?? 'post';
}

function toFrameMedia(media: PostMedia, format: MediaFormat): MediaItem {
  return {
    id: media.id,
    name: media.alt ?? 'media',
    url: media.url,
    type: media.type,
    format,
    mimeType: null,
    fileSize: 0,
    thumbnail: null,
    alt: media.alt,
    createdAt: new Date().toISOString(),
  };
}

function InstagramLivePreview({
  channel,
  main,
  comments,
}: {
  channel: ChannelItem;
  main: ThreadItemDraft;
  comments: ThreadItemDraft[];
}) {
  const format = mediaFormat(main.media);
  const accountName = channel.username ?? channel.name;

  if (main.media.length === 0) {
    return (
      <div className="border-border bg-surface-muted/40 text-muted-foreground rounded-xl border border-dashed p-6 text-center text-sm">
        Add a Post, Reel or Story media to preview Instagram
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-sm space-y-3">
      <InstagramFrame
        key={`frame-${format}-${main.media.map((entry) => entry.id).join('-')}`}
        media={toFrameMedia(main.media[0], format)}
        gallery={
          format === 'post' && main.media.length > 1
            ? main.media.map((entry) => toFrameMedia(entry, format))
            : undefined
        }
        accountName={accountName}
        active
        controls
        caption={main.content}
      />
      {format === 'post' && comments.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white px-3 py-2 text-[13px] text-neutral-900">
          {comments.map((comment) => (
            <p key={comment.key} className="py-1 break-words whitespace-pre-wrap">
              <span className="font-semibold">{accountName}</span>{' '}
              {comment.content.trim() || '…'}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function FacebookLivePreview({
  channel,
  main,
  comments,
}: {
  channel: ChannelItem;
  main: ThreadItemDraft;
  comments: ThreadItemDraft[];
}) {
  const format = mediaFormat(main.media);

  if (format === 'story' && main.media[0]) {
    return <FacebookStoryFrame channel={channel} media={main.media[0]} />;
  }

  if (format === 'reel' && main.media[0]) {
    return (
      <FacebookReelFrame channel={channel} media={main.media[0]} caption={main.content} />
    );
  }

  return <FacebookFeedPreview channel={channel} main={main} comments={comments} />;
}

function FacebookStoryFrame({ channel, media }: { channel: ChannelItem; media: PostMedia }) {
  return (
    <div className="relative mx-auto aspect-[9/16] w-full max-w-sm overflow-hidden rounded-xl bg-neutral-900 text-white">
      {media.type === 'video' ? (
        <video
          src={media.url}
          className="absolute inset-0 h-full w-full object-cover"
          muted
          loop
          autoPlay
          playsInline
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={media.url} alt="" className="absolute inset-0 h-full w-full object-cover" />
      )}
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/50 to-transparent" />
      <div className="absolute inset-x-2 top-2 h-0.5 overflow-hidden rounded-full bg-white/35">
        <div className="h-full w-1/3 rounded-full bg-white" />
      </div>
      <div className="absolute inset-x-3 top-5 flex items-center gap-2">
        <ChannelAvatar name={channel.name} picture={channel.picture} size="sm" />
        <span className="truncate text-[13px] font-semibold">{channel.name}</span>
        <span className="text-[13px] text-white/70">now</span>
      </div>
    </div>
  );
}

function FacebookReelFrame({
  channel,
  media,
  caption,
}: {
  channel: ChannelItem;
  media: PostMedia;
  caption: string;
}) {
  return (
    <div className="relative mx-auto aspect-[9/16] w-full max-w-sm overflow-hidden rounded-xl bg-black text-white">
      {media.type === 'video' ? (
        <video
          src={media.url}
          className="absolute inset-0 h-full w-full object-cover"
          muted
          loop
          autoPlay
          playsInline
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={media.url} alt="" className="absolute inset-0 h-full w-full object-cover" />
      )}
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/80 to-transparent" />
      <div className="absolute right-3 bottom-20 flex flex-col items-center gap-4">
        <ThumbsUp className="size-6" />
        <MessageCircle className="size-6" />
        <Send className="size-6" />
      </div>
      <div className="absolute right-14 bottom-6 left-3 space-y-2">
        <div className="flex items-center gap-2">
          <ChannelAvatar name={channel.name} picture={channel.picture} size="sm" />
          <span className="truncate text-sm font-semibold">{channel.name}</span>
        </div>
        <p className="line-clamp-3 text-sm whitespace-pre-wrap">{caption || 'Reel'}</p>
        <p className="text-xs text-white/70">Reels</p>
      </div>
    </div>
  );
}

function FacebookFeedPreview({
  channel,
  main,
  comments,
}: {
  channel: ChannelItem;
  main: ThreadItemDraft;
  comments: ThreadItemDraft[];
}) {
  return (
    <article className="border-border bg-surface overflow-hidden rounded-xl border">
      <div className="p-4">
        <header className="mb-3 flex items-center gap-3">
          <div className="relative shrink-0">
            <ChannelAvatar name={channel.name} picture={channel.picture} size="md" />
            <ProviderMark
              identifier={channel.providerIdentifier}
              name={channel.providerName}
              size="sm"
              className="ring-surface absolute -right-1 -bottom-1 size-4 ring-2"
            />
          </div>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-semibold">{channel.name}</p>
            <p className="text-muted-foreground flex items-center gap-1 text-xs">
              Just now · <Globe className="size-3" />
            </p>
          </div>
        </header>

        {main.content.trim() && (
          <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">
            <MentionText text={main.content} />
          </p>
        )}

        {main.media.length > 0 && (
          <div className="mt-3 overflow-hidden rounded-lg">
            {main.media.length === 1 ? (
              <PreviewMedia media={main.media[0]} tall />
            ) : (
              <div className="grid grid-cols-2 gap-1">
                {main.media.map((media) => (
                  <PreviewMedia key={media.id} media={media} />
                ))}
              </div>
            )}
          </div>
        )}

        <div className="text-muted-foreground mt-3 flex items-center justify-between text-xs">
          <span className="flex items-center gap-1">
            <span className="flex size-4 items-center justify-center rounded-full bg-[#1877f2] text-white">
              <ThumbsUp className="size-2.5 fill-current" />
            </span>
            88
          </span>
          <span>
            {comments.length} comment{comments.length === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      <div className="border-border text-muted-foreground grid grid-cols-3 border-t text-xs font-medium">
        <PreviewAction icon={<ThumbsUp className="size-4" />} label="Like" />
        <PreviewAction icon={<MessageCircle className="size-4" />} label="Comment" />
        <PreviewAction icon={<ShareIcon />} label="Share" />
      </div>

      {comments.length > 0 && (
        <div className="border-border space-y-3 border-t p-4">
          {comments.map((comment) => (
            <div key={comment.key} className="flex gap-2.5">
              <ChannelAvatar name={channel.name} picture={channel.picture} size="sm" />
              <div className="bg-surface-muted min-w-0 flex-1 rounded-2xl px-3 py-2">
                <p className="text-sm font-semibold">{channel.name}</p>
                <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">
                  {comment.content.trim() ? (
                    <MentionText text={comment.content} />
                  ) : (
                    <span className="text-muted-foreground italic">Empty comment</span>
                  )}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

function GlobalEditPreview({
  channel,
  items,
}: {
  channel: ChannelItem;
  items: ThreadItemDraft[];
}) {
  return (
    <ul className="relative space-y-0">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <li key={item.key} className="relative flex gap-3 pb-6">
            {!isLast && (
              <span aria-hidden className="bg-border absolute top-10 bottom-0 left-[15px] w-px" />
            )}
            <div className="bg-surface-muted relative z-10 flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full">
              {channel.picture ? (
                <ChannelAvatar name={channel.name} picture={channel.picture} size="sm" />
              ) : (
                <span className="bg-muted text-muted-foreground size-full rounded-full" />
              )}
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="mb-1 flex items-center gap-1.5">
                <span className="text-sm font-semibold">Global Edit</span>
                <BadgeCheck className="size-4 fill-[#0a66c2] text-white" />
              </div>
              <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">
                {item.content.trim() ? (
                  <MentionText text={item.content} />
                ) : (
                  <span className="text-muted-foreground italic">Empty</span>
                )}
              </p>
              {item.media.length > 0 && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {item.media.map((media) => (
                    <PreviewMedia key={media.id} media={media} />
                  ))}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function LinkedInPreview({
  channel,
  main,
  comments,
}: {
  channel: ChannelItem;
  main: ThreadItemDraft;
  comments: ThreadItemDraft[];
}) {
  const format = mediaFormat(main.media);
  const commentCount = comments.filter((item) => item.content.trim() || item.media.length).length;

  if (format === 'story' && main.media[0]) {
    return <FacebookStoryFrame channel={channel} media={main.media[0]} />;
  }

  if (format === 'reel' && main.media[0]) {
    return (
      <FacebookReelFrame channel={channel} media={main.media[0]} caption={main.content} />
    );
  }

  return (
    <article className="border-border bg-surface overflow-hidden rounded-xl border">
      <div className="p-4">
        <header className="mb-3 flex items-start gap-3">
          <div className="relative shrink-0">
            <ChannelAvatar name={channel.name} picture={channel.picture} size="md" />
            <ProviderMark
              identifier={channel.providerIdentifier}
              name={channel.providerName}
              size="sm"
              className="ring-surface absolute -right-1 -bottom-1 size-4 ring-2"
            />
          </div>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-semibold">{channel.name}</p>
            <p className="text-muted-foreground text-xs">2,871 followers</p>
            <p className="text-muted-foreground mt-0.5 flex items-center gap-1 text-xs">
              30m · <Globe className="size-3" />
            </p>
          </div>
        </header>

        <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">
          <MentionText text={main.content} />
        </p>

        {main.media.length > 0 && (
          <div className="mt-3 overflow-hidden rounded-lg">
            {main.media.length === 1 ? (
              <PreviewMedia media={main.media[0]} tall />
            ) : (
              <div className="grid grid-cols-2 gap-1">
                {main.media.map((media) => (
                  <PreviewMedia key={media.id} media={media} />
                ))}
              </div>
            )}
          </div>
        )}

        <div className="text-muted-foreground mt-3 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5">
            <span className="flex -space-x-1">
              <span className="flex size-4 items-center justify-center rounded-full bg-[#378fe9] text-white">
                <ThumbsUp className="size-2.5 fill-current" />
              </span>
              <span className="flex size-4 items-center justify-center rounded-full bg-[#df704d] text-white">
                <Heart className="size-2.5 fill-current" />
              </span>
            </span>
            <span>88</span>
          </div>
          <span>
            {commentCount} comment{commentCount === 1 ? '' : 's'} · 0 reposts
          </span>
        </div>
      </div>

      <div className="border-border text-muted-foreground grid grid-cols-4 border-t text-xs font-medium">
        <PreviewAction icon={<ThumbsUp className="size-4" />} label="Like" />
        <PreviewAction icon={<MessageCircle className="size-4" />} label="Comments" />
        <PreviewAction icon={<Repeat2 className="size-4" />} label="Repost" />
        <PreviewAction icon={<Send className="size-4" />} label="Send" />
      </div>

      {comments.length > 0 && (
        <div className="border-border space-y-4 border-t p-4">
          {comments.map((comment) => (
            <div key={comment.key} className="flex gap-2.5">
              <ChannelAvatar name={channel.name} picture={channel.picture} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="bg-surface-muted rounded-xl px-3 py-2">
                  <div className="mb-0.5 flex flex-wrap items-center gap-1.5">
                    <p className="text-sm font-semibold">{channel.name}</p>
                    <span className="text-muted-foreground text-[11px]">· Founder</span>
                  </div>
                  <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">
                    {comment.content.trim() ? (
                      <MentionText text={comment.content} />
                    ) : (
                      <span className="text-muted-foreground italic">Empty comment</span>
                    )}
                  </p>
                </div>
                <div className="text-muted-foreground mt-1 flex gap-3 px-1 text-xs font-medium">
                  <span>Like</span>
                  <span>Reply</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

function PreviewAction({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="hover:bg-surface-muted flex items-center justify-center gap-1.5 py-3 transition">
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </div>
  );
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4">
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  );
}

function MentionText({ text }: { text: string }) {
  const parts = text.split(/(@[\w.]+)/g);
  return (
    <>
      {parts.map((part, index) =>
        part.startsWith('@') ? (
          <span key={`${part}-${index}`} className="text-[#378fe9]">
            {part}
          </span>
        ) : (
          <span key={`${part}-${index}`}>{part}</span>
        )
      )}
    </>
  );
}

function PreviewMedia({ media, tall }: { media: PostMedia; tall?: boolean }) {
  const height = tall ? 'aspect-square max-h-72 w-full object-cover' : 'h-28 w-full object-cover';

  if (media.type === 'video') {
    return <video src={media.url} className={`rounded-lg ${height}`} muted preload="metadata" />;
  }

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={media.url} alt="" className={`rounded-lg ${height}`} />;
}
