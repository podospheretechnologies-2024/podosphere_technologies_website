'use client';

import {
  Bold,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  ImagePlus,
  Plug,
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
import { POST_MAX_MEDIA } from '../../../config/posts';
import type { PostMedia } from '../../../types/post';
import { ProviderMark } from '../../channels/provider-mark';
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
  const [customDelay, setCustomDelay] = useState(
    item.delay > 0 && !DELAY_PRESETS.some((p) => p.minutes === item.delay)
      ? String(item.delay)
      : ''
  );
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const delayRef = useRef<HTMLDivElement>(null);
  const limitsRef = useRef<HTMLDivElement>(null);
  const length = item.content.trim().length;
  const overLimit = maxLength !== null && length > maxLength;
  const withinLimit = maxLength === null || length <= maxLength;

  useEffect(() => {
    if (!delayOpen && !limitsOpen) {
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
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [delayOpen, limitsOpen]);

  function wrapSelection(before: string, after = before) {
    const el = textareaRef.current;
    if (!el) {
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = item.content.slice(start, end);
    const next = `${item.content.slice(0, start)}${before}${selected}${after}${item.content.slice(end)}`;
    onChange({ ...item, content: next });
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + before.length, end + before.length);
    });
  }

  function insertEmoji() {
    const el = textareaRef.current;
    if (!el) {
      return;
    }
    const start = el.selectionStart;
    const emoji = '😊';
    const next = `${item.content.slice(0, start)}${emoji}${item.content.slice(el.selectionEnd)}`;
    onChange({ ...item, content: next });
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + emoji.length;
      el.setSelectionRange(pos, pos);
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
          placeholder={index === 0 ? 'Write something...' : 'Write a comment…'}
          aria-label={index === 0 ? 'Post content' : `Comment ${index}`}
          rows={index === 0 ? 5 : 3}
          className="placeholder:text-muted-foreground block w-full resize-y bg-transparent p-3 text-sm outline-none"
        />

        {item.media.length > 0 && (
          <div className="flex flex-wrap gap-2 px-3 pb-3">
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
          <ToolbarButton label="Integrations" icon={<Plug className="size-3.5" />} disabled />
          <ToolbarButton label="AI Image" icon={<Sparkles className="size-3.5" />} disabled />
          <ToolbarButton label="AI Video" icon={<Video className="size-3.5" />} disabled />

          <div className="ml-auto flex items-center gap-0.5">
            <FormatButton
              label="Bold"
              icon={<Bold className="size-3.5" />}
              onClick={() => wrapSelection('**')}
            />
            <FormatButton
              label="Underline"
              icon={<Underline className="size-3.5" />}
              onClick={() => wrapSelection('<u>', '</u>')}
            />
            <FormatButton label="Emoji" icon={<Smile className="size-3.5" />} onClick={insertEmoji} />
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
        onInsert={(media) =>
          onChange({
            ...item,
            media: [
              ...item.media,
              ...media.filter((entry) => !item.media.some((existing) => existing.id === entry.id)),
            ],
          })
        }
      />
    </div>
  );
}
