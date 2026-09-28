'use client';

import Image from 'next/image';
import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/cn';
import { POST_MAX_MEDIA } from '../../../config/posts';
import type { PostMedia } from '../../../types/post';
import { MediaPicker } from './media-picker';

export interface ThreadItemDraft {
  key: string;
  content: string;
  media: PostMedia[];
  delay: number;
}

interface ThreadItemEditorProps {
  item: ThreadItemDraft;
  index: number;
  maxLength: number | null;
  onChange: (item: ThreadItemDraft) => void;
  onRemove?: () => void;
}

export function ThreadItemEditor({
  item,
  index,
  maxLength,
  onChange,
  onRemove,
}: ThreadItemEditorProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const length = item.content.trim().length;
  const overLimit = maxLength !== null && length > maxLength;

  return (
    <div className="border-border rounded-lg border">
      <textarea
        value={item.content}
        onChange={(event) => onChange({ ...item, content: event.target.value })}
        placeholder={index === 0 ? 'What do you want to share?' : 'Write a comment…'}
        aria-label={index === 0 ? 'Post content' : `Comment ${index}`}
        rows={index === 0 ? 6 : 3}
        className="placeholder:text-muted-foreground block w-full resize-y rounded-t-lg bg-transparent p-3 text-sm outline-none"
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
                  onChange({ ...item, media: item.media.filter((entry) => entry.id !== media.id) })
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

      <div className="border-border flex items-center justify-between gap-2 border-t px-2 py-1.5">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPickerOpen(true)}
            disabled={item.media.length >= POST_MAX_MEDIA}
          >
            Add media
          </Button>
          {onRemove && (
            <Button variant="danger-ghost" size="sm" onClick={onRemove}>
              Remove comment
            </Button>
          )}
        </div>
        <span
          className={cn(
            'text-xs tabular-nums',
            overLimit ? 'text-danger' : 'text-muted-foreground'
          )}
        >
          {maxLength === null ? length : `${length} / ${maxLength}`}
        </span>
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
