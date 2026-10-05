'use client';

import {
  Bold,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  ImagePlus,
  Plug,
  Sheet,
  Smile,
  Sparkles,
  Trash2,
  Underline,
  Video,
  Wand2,
} from 'lucide-react';
import Image from 'next/image';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';
import { MEDIA_FORMAT_OPTIONS, type MediaFormat } from '../../../config/media';
import { POST_MAX_MEDIA } from '../../../config/posts';
import type { PostMedia } from '../../../types/post';
import { ProviderMark } from '../../channels/provider-mark';
import { GeneratePostFromSheetsDialog } from './generate-post-from-sheets-dialog';
import { MediaPicker } from './media-picker';

export interface ThreadItemDraft {
  key: string;
  content: string;
  media: PostMedia[];
  delay: number;
}

export interface ChannelLimitRow {
  id: string;
  name: string;
  providerIdentifier: string;
  providerName: string;
  maxLength: number;
}

interface ThreadItemEditorProps {
  item: ThreadItemDraft;
  index: number;
  maxLength: number | null;
  channelLimits?: ChannelLimitRow[];
  /** Posting date (datetime-local) used to auto-match Google Sheets rows. */
  postDate?: string;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onChange: (item: ThreadItemDraft) => void;
  onRemove?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

const DELAY_PRESETS = [
  { label: '1m', minutes: 1 },
  { label: '2m', minutes: 2 },
  { label: '5m', minutes: 5 },
  { label: '10m', minutes: 10 },
  { label: '15m', minutes: 15 },
  { label: '30m', minutes: 30 },
  { label: '1h', minutes: 60 },
  { label: '2h', minutes: 120 },
] as const;

const COMBINING_LOW_LINE = '\u0332';

const EMOJI_GROUPS: { label: string; emojis: string[] }[] = [
  {
    label: 'Smileys',
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '😉', '😊', '😇', '🥰', '😍', '🤩',
      '😘', '😗', '😚', '😙', '🥲', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔',
      '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '😮‍💨', '🤥', '😌', '😔', '😪', '😴',
      '😷', '🤒', '🤕', '🤢', '🤮', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '😎', '🤓', '🧐',
    ],
  },
  {
    label: 'Gestures',
    emojis: [
      '👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '👇', '☝️', '✋', '🤚',
      '🖐', '🖖', '👋', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '💪', '🦾', '💅', '🤳', '✍️', '🫶',
    ],
  },
  {
    label: 'Hearts',
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗',
      '💖', '💘', '💝', '💟', '♥️', '💌', '💋', '💯', '💥', '💫', '⭐', '🌟', '✨', '⚡', '🔥',
    ],
  },
  {
    label: 'People',
    emojis: [
      '👋', '🙋', '💁', '🙆', '🙅', '🤷', '🤦', '🙇', '🤰', '🤱', '👶', '👧', '👦', '👩', '👨',
      '🧓', '👵', '👴', '👮', '👷', '💂', '🕵️', '👩‍💻', '👨‍💻', '👩‍🎨', '👨‍🎨', '🧑‍🚀', '🦸', '🦹', '🧙',
    ],
  },
  {
    label: 'Animals',
    emojis: [
      '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵',
      '🐔', '🐧', '🐦', '🐤', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋',
    ],
  },
  {
    label: 'Food',
    emojis: [
      '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥',
      '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🍔', '🍟', '🍕', '🌭', '🥪', '🌮', '🌯', '🥗', '🍝',
      '🍜', '🍣', '🍱', '🍦', '🍩', '🍪', '🎂', '🍰', '🧁', '🍫', '☕', '🍵', '🧃', '🥤', '🍺',
    ],
  },
  {
    label: 'Travel',
    emojis: [
      '🚗', '🚕', '🚙', '🚌', '🚎', '🏎', '🚓', '🚑', '🚒', '🚐', '🛻', '🚚', '🚛', '🚜', '🛵',
      '🚲', '🛴', '✈️', '🛫', '🛬', '🛩', '🚁', '🚟', '🚠', '🚡', '🛥', '⛵️', '🚤', '🛳', '🚀',
      '🏠', '🏡', '🏢', '🏣', '🏥', '🏦', '🏨', '🏫', '🏬', '🏭', '🗺', '🧭', '🏖', '🏔', '🗻',
    ],
  },
  {
    label: 'Objects',
    emojis: [
      '⌚', '📱', '💻', '⌨️', '🖥', '🖨', '🖱', '🖲', '🕹', '🗜', '💾', '💿', '📷', '📸', '📹',
      '🎥', '📽', '🎞', '📞', '☎️', '📟', '📠', '📺', '📻', '🎙', '⏱', '⏲', '⏰', '🕰', '⌛',
      '💡', '🔦', '🕯', '📔', '📕', '📖', '📚', '📝', '✏️', '📌', '📎', '🔑', '🗝', '💰', '💳',
    ],
  },
  {
    label: 'Symbols',
    emojis: [
      '✅', '❌', '⭕', '❗', '❓', '‼️', '⁉️', '💬', '💭', '🗯', '♠️', '♥️', '♦️', '♣️', '🃏',
      '🎴', '🀄️', '🕐', '🕑', '🕒', '🕓', '🕔', '🕕', '♻️', '🔰', '🔱', '📛', '⭕', '🛑', '⛔️',
      '🚫', '🔞', '📵', '🚭', '❗️', '❕', '❓', '❔', '™️', '©️', '®️', '〰️', '➰', '➿', '〽️',
    ],
  },
];

function stripLegacyMarkup(text: string): string {
  return text
    .replace(/<\/?u>/gi, '')
    .replace(/\*\*([\s\S]+?)\*\*/g, '$1')
    .replace(/__([\s\S]+?)__/g, '$1');
}

function mapLatinToBold(char: string): string {
  const code = char.codePointAt(0);
  if (code === undefined) return char;
  if (code >= 65 && code <= 90) return String.fromCodePoint(0x1d5d4 + (code - 65));
  if (code >= 97 && code <= 122) return String.fromCodePoint(0x1d5ee + (code - 97));
  if (code >= 48 && code <= 57) return String.fromCodePoint(0x1d7ec + (code - 48));
  return char;
}

function mapBoldToLatin(char: string): string {
  const code = char.codePointAt(0);
  if (code === undefined) return char;
  if (code >= 0x1d5d4 && code <= 0x1d5ed) return String.fromCodePoint(65 + (code - 0x1d5d4));
  if (code >= 0x1d5ee && code <= 0x1d607) return String.fromCodePoint(97 + (code - 0x1d5ee));
  if (code >= 0x1d7ec && code <= 0x1d7f5) return String.fromCodePoint(48 + (code - 0x1d7ec));
  return char;
}

function isBoldText(text: string): boolean {
  const letters = [...text].filter((char) => /[A-Za-z0-9]/.test(mapBoldToLatin(char)));
  if (letters.length === 0) return false;
  return letters.every((char) => {
    const code = char.codePointAt(0)!;
    return (
      (code >= 0x1d5d4 && code <= 0x1d5ed) ||
      (code >= 0x1d5ee && code <= 0x1d607) ||
      (code >= 0x1d7ec && code <= 0x1d7f5)
    );
  });
}

function toggleBold(text: string): string {
  const cleaned = stripLegacyMarkup(text);
  if (!cleaned) return cleaned;
  if (isBoldText(cleaned)) {
    return [...cleaned].map(mapBoldToLatin).join('');
  }
  return [...cleaned].map(mapLatinToBold).join('');
}

function isUnderlined(text: string): boolean {
  const chars = [...text].filter((char) => char !== COMBINING_LOW_LINE && char.trim());
  if (chars.length === 0) return false;
  // Every visible char should be followed by a combining underline in the original string.
  const withoutSpaces = text.replace(/\s/g, '');
  if (!withoutSpaces) return false;
  const pairs = withoutSpaces.match(/./gu) ?? [];
  let underlined = 0;
  let total = 0;
  for (let i = 0; i < pairs.length; i += 1) {
    if (pairs[i] === COMBINING_LOW_LINE) continue;
    total += 1;
    if (pairs[i + 1] === COMBINING_LOW_LINE) underlined += 1;
  }
  return total > 0 && underlined / total >= 0.6;
}

function toggleUnderline(text: string): string {
  const cleaned = stripLegacyMarkup(text);
  if (!cleaned) return cleaned;
  if (isUnderlined(cleaned) || cleaned.includes(COMBINING_LOW_LINE)) {
    return cleaned.replaceAll(COMBINING_LOW_LINE, '');
  }
  return [...cleaned]
    .map((char) => (char === ' ' || char === '\n' ? char : `${char}${COMBINING_LOW_LINE}`))
    .join('');
}

function ToolbarButton({
  label,
  icon,
  onClick,
  disabled,
}: {
  label: string;
  icon: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      className="border-border text-muted-foreground hover:bg-surface-muted hover:text-foreground inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40"
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function FormatButton({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      title={label}
      aria-label={label}
      className="text-muted-foreground hover:bg-surface-muted hover:text-foreground flex size-8 items-center justify-center rounded-md transition"
    >
      {icon}
    </button>
  );
}

export function ThreadItemEditor({
  item,
  index,
  maxLength,
  channelLimits = [],
  postDate,
  canMoveUp,
  canMoveDown,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}: ThreadItemEditorProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [delayOpen, setDelayOpen] = useState(false);
  const [limitsOpen, setLimitsOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [customDelay, setCustomDelay] = useState(
    item.delay > 0 && !DELAY_PRESETS.some((p) => p.minutes === item.delay)
      ? String(item.delay)
      : ''
  );
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const delayRef = useRef<HTMLDivElement>(null);
  const limitsRef = useRef<HTMLDivElement>(null);
  const emojiRef = useRef<HTMLDivElement>(null);
  const selectionRef = useRef({ start: 0, end: 0 });
  const length = item.content.trim().length;
  const overLimit = maxLength !== null && length > maxLength;
  const withinLimit = maxLength === null || length <= maxLength;
  const mediaFormat: MediaFormat =
    item.media.find((entry) => entry.format)?.format ?? 'post';
  const hasVideo = item.media.some((entry) => entry.type === 'video');

  function setMediaFormat(format: MediaFormat) {
    if (format === 'reel' && !hasVideo) {
      return;
    }
    onChange({
      ...item,
      media: item.media.map((entry) => ({ ...entry, format })),
    });
  }

  useEffect(() => {
    if (!delayOpen && !limitsOpen && !emojiOpen) {
      return;
    }
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (delayOpen && delayRef.current && !delayRef.current.contains(target)) {
        setDelayOpen(false);
      }
      if (limitsOpen && limitsRef.current && !limitsRef.current.contains(target)) {
        setLimitsOpen(false);
      }
      if (emojiOpen && emojiRef.current && !emojiRef.current.contains(target)) {
        setEmojiOpen(false);
      }
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [delayOpen, limitsOpen, emojiOpen]);

  function rememberSelection() {
    const el = textareaRef.current;
    if (!el) {
      return;
    }
    selectionRef.current = { start: el.selectionStart, end: el.selectionEnd };
  }

  function applySelectionTransform(transform: (selected: string) => string) {
    const el = textareaRef.current;
    if (!el) {
      return;
    }
    rememberSelection();
    const { start, end } = selectionRef.current;
    if (start === end) {
      return;
    }
    const selected = item.content.slice(start, end);
    const nextSelected = transform(selected);
    const next = `${item.content.slice(0, start)}${nextSelected}${item.content.slice(end)}`;
    onChange({ ...item, content: next });
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start, start + nextSelected.length);
      rememberSelection();
    });
  }

  function insertEmoji(emoji: string) {
    const el = textareaRef.current;
    if (!el) {
      return;
    }
    const { start, end } = selectionRef.current;
    const next = `${item.content.slice(0, start)}${emoji}${item.content.slice(end)}`;
    onChange({ ...item, content: next });
    setEmojiOpen(false);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + emoji.length;
      el.setSelectionRange(pos, pos);
      rememberSelection();
    });
  }

  function setDelay(minutes: number) {
    onChange({ ...item, delay: Math.max(0, minutes) });
    setDelayOpen(false);
    setCustomDelay('');
  }

  return (
    <div className="flex gap-2">
      <div className="border-border bg-surface-muted/20 min-w-0 flex-1 overflow-hidden rounded-xl border">
        <textarea
          ref={textareaRef}
          value={item.content}
          onChange={(event) => onChange({ ...item, content: event.target.value })}
          onSelect={rememberSelection}
          onKeyUp={rememberSelection}
          onClick={rememberSelection}
          placeholder={index === 0 ? 'Write something...' : 'Write a comment…'}
          aria-label={index === 0 ? 'Post content' : `Comment ${index}`}
          rows={index === 0 ? 5 : 3}
          className="placeholder:text-muted-foreground block w-full resize-y bg-transparent p-3 text-sm outline-none"
        />

        {item.media.length > 0 && (
          <div className="space-y-2 px-3 pb-3">
            <div
              role="radiogroup"
              aria-label="Media format"
              className="bg-surface-muted/50 flex w-fit flex-wrap gap-1 rounded-lg p-1"
            >
              {MEDIA_FORMAT_OPTIONS.map((option) => {
                const disabled = option.value === 'reel' && !hasVideo;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={mediaFormat === option.value}
                    disabled={disabled}
                    title={
                      disabled ? 'Reels need a video. Add a video first.' : option.label
                    }
                    onClick={() => setMediaFormat(option.value)}
                    className={cn(
                      'rounded-md px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40',
                      mediaFormat === option.value
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:bg-surface-muted hover:text-foreground'
                    )}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-2">
              {item.media.map((media) => (
                <div
                  key={media.id}
                  className="bg-surface-muted group relative size-16 overflow-hidden rounded-md"
                >
                  {media.type === 'video' ? (
                    <video
                      src={media.url}
                      className="h-full w-full object-cover"
                      muted
                      preload="metadata"
                    />
                  ) : (
                    <Image
                      src={media.url}
                      alt=""
                      fill
                      unoptimized
                      sizes="64px"
                      className="object-cover"
                    />
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      onChange({
                        ...item,
                        media: item.media.filter((entry) => entry.id !== media.id),
                      })
                    }
                    aria-label="Remove media"
                    className="absolute top-0.5 right-0.5 flex size-5 items-center justify-center rounded-full bg-black/70 text-xs text-white"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="border-border flex flex-wrap items-center gap-1.5 border-t px-2 py-2">
          <ToolbarButton
            label="Insert Media"
            icon={<ImagePlus className="size-3.5" />}
            onClick={() => setPickerOpen(true)}
            disabled={item.media.length >= POST_MAX_MEDIA}
          />
          <ToolbarButton
            label="Design Media"
            icon={<Wand2 className="size-3.5" />}
            disabled
          />
          <ToolbarButton
            label="Generate Post"
            icon={<Sheet className="size-3.5" />}
            onClick={() => setGenerateOpen(true)}
          />
          <ToolbarButton label="Integrations" icon={<Plug className="size-3.5" />} disabled />
          <ToolbarButton label="AI Image" icon={<Sparkles className="size-3.5" />} disabled />
          <ToolbarButton label="AI Video" icon={<Video className="size-3.5" />} disabled />

          <div className="ml-auto flex items-center gap-0.5">
            <FormatButton
              label="Bold"
              icon={<Bold className="size-3.5" />}
              onClick={() => applySelectionTransform(toggleBold)}
            />
            <FormatButton
              label="Underline"
              icon={<Underline className="size-3.5" />}
              onClick={() => applySelectionTransform(toggleUnderline)}
            />
            <div className="relative" ref={emojiRef}>
              <FormatButton
                label="Emoji"
                icon={<Smile className="size-3.5" />}
                onClick={() => {
                  rememberSelection();
                  setEmojiOpen((open) => !open);
                }}
              />
              {emojiOpen && (
                <div className="border-border bg-surface absolute right-0 bottom-full z-40 mb-2 w-[300px] overflow-hidden rounded-xl border shadow-lg sm:w-[340px]">
                  <div className="border-border flex items-center justify-between border-b px-3 py-2">
                    <p className="text-xs font-semibold">Emojis</p>
                    <button
                      type="button"
                      onClick={() => setEmojiOpen(false)}
                      className="text-muted-foreground hover:text-foreground text-xs"
                    >
                      Close
                    </button>
                  </div>
                  <div className="max-h-64 overflow-y-auto p-2">
                    {EMOJI_GROUPS.map((group) => (
                      <div key={group.label} className="mb-2 last:mb-0">
                        <p className="text-muted-foreground px-1 pb-1 text-[10px] font-semibold tracking-wide uppercase">
                          {group.label}
                        </p>
                        <div className="grid grid-cols-8 gap-0.5">
                          {group.emojis.map((emoji) => (
                            <button
                              key={`${group.label}-${emoji}`}
                              type="button"
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => insertEmoji(emoji)}
                              title={emoji}
                              className="hover:bg-surface-muted flex size-8 items-center justify-center rounded-md text-lg transition"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="relative" ref={limitsRef}>
              <button
                type="button"
                onClick={() => setLimitsOpen((open) => !open)}
                aria-expanded={limitsOpen}
                title="Character limits"
                className={cn(
                  'ml-1 inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs tabular-nums transition',
                  overLimit
                    ? 'border-danger/50 text-danger'
                    : withinLimit
                      ? 'border-success/40 text-success'
                      : 'border-border text-muted-foreground'
                )}
              >
                {maxLength === null ? length : `${length}/${maxLength}`}
                {withinLimit && !overLimit && <Check className="size-3" />}
                {channelLimits.length > 0 && <ChevronDown className="size-3 opacity-70" />}
              </button>
              {limitsOpen && channelLimits.length > 0 && (
                <div className="border-border bg-surface absolute right-0 bottom-full z-30 mb-2 w-56 overflow-hidden rounded-xl border shadow-lg">
                  <ul className="max-h-64 overflow-y-auto py-1">
                    {channelLimits.map((channel) => {
                      const over = length > channel.maxLength;
                      return (
                        <li
                          key={channel.id}
                          className="flex items-center gap-2 px-3 py-2 text-xs"
                        >
                          <ProviderMark
                            identifier={channel.providerIdentifier}
                            name={channel.providerName}
                            size="sm"
                            className="size-4 shrink-0"
                          />
                          <span className="min-w-0 flex-1 truncate">{channel.providerName}</span>
                          <span
                            className={cn(
                              'tabular-nums',
                              over ? 'text-danger' : 'text-muted-foreground'
                            )}
                          >
                            {length}/{channel.maxLength}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-center gap-1 pt-1">
        {(canMoveUp || canMoveDown) && (
          <>
            <button
              type="button"
              onClick={onMoveUp}
              disabled={!canMoveUp}
              aria-label="Move up"
              className="text-muted-foreground hover:text-foreground disabled:opacity-30"
            >
              <ChevronUp className="size-4" />
            </button>
            <button
              type="button"
              onClick={onMoveDown}
              disabled={!canMoveDown}
              aria-label="Move down"
              className="text-muted-foreground hover:text-foreground disabled:opacity-30"
            >
              <ChevronDown className="size-4" />
            </button>
          </>
        )}
        {index > 0 && (
          <div className="relative" ref={delayRef}>
            <button
              type="button"
              title={item.delay > 0 ? `Delay ${item.delay}m` : 'Delay comment'}
              onClick={() => setDelayOpen((open) => !open)}
              aria-expanded={delayOpen}
              className={cn(
                'flex size-8 items-center justify-center rounded-md transition',
                item.delay > 0
                  ? 'bg-ai/15 text-ai'
                  : 'text-muted-foreground hover:bg-surface-muted hover:text-foreground'
              )}
            >
              <Clock className="size-4" />
            </button>
            {delayOpen && (
              <div className="border-border bg-surface absolute top-0 right-full z-30 mr-2 w-48 rounded-xl border p-3 shadow-lg">
                <p className="text-muted-foreground mb-2 text-xs font-medium">Delay comment</p>
                <div className="grid grid-cols-4 gap-1.5">
                  {DELAY_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setDelay(preset.minutes)}
                      className={cn(
                        'rounded-md border px-1.5 py-1.5 text-xs font-medium transition',
                        item.delay === preset.minutes
                          ? 'border-primary bg-primary/15 text-primary'
                          : 'border-border text-muted-foreground hover:bg-surface-muted hover:text-foreground'
                      )}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <div className="mt-2 flex items-center gap-1.5">
                  <input
                    type="number"
                    min={0}
                    placeholder="Custom min"
                    value={customDelay}
                    onChange={(event) => setCustomDelay(event.target.value)}
                    className="border-border bg-surface-muted/40 placeholder:text-muted-foreground h-8 min-w-0 flex-1 rounded-md border px-2 text-xs outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const minutes = Number.parseInt(customDelay, 10);
                      if (!Number.isFinite(minutes) || minutes < 0) {
                        return;
                      }
                      setDelay(minutes);
                    }}
                    className="bg-primary text-primary-foreground h-8 shrink-0 rounded-md px-2.5 text-xs font-semibold"
                  >
                    Set
                  </button>
                </div>
                {item.delay > 0 && (
                  <button
                    type="button"
                    onClick={() => setDelay(0)}
                    className="text-muted-foreground hover:text-foreground mt-2 w-full text-left text-xs"
                  >
                    Clear delay
                  </button>
                )}
              </div>
            )}
          </div>
        )}
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remove comment"
            className="text-danger hover:bg-danger/10 flex size-8 items-center justify-center rounded-md transition"
          >
            <Trash2 className="size-4" />
          </button>
        )}
      </div>

      <MediaPicker
        open={pickerOpen}
        alreadySelected={item.media.length}
        onClose={() => setPickerOpen(false)}
        onInsert={(media) => {
          const additions = media.filter(
            (entry) => !item.media.some((existing) => existing.id === entry.id)
          );
          if (additions.length === 0) {
            return;
          }
          const format = additions[0].format ?? mediaFormat;
          onChange({
            ...item,
            media: [...item.media, ...additions].map((entry) => ({ ...entry, format })),
          });
        }}
      />

      <GeneratePostFromSheetsDialog
        open={generateOpen}
        postDate={postDate ?? new Date().toISOString()}
        onClose={() => setGenerateOpen(false)}
        onApply={(content) => onChange({ ...item, content })}
      />
    </div>
  );
}
