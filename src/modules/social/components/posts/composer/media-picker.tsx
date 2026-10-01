'use client';

import Image from 'next/image';
import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Modal } from '@/shared/components/ui/modal';
import { cn } from '@/shared/lib/cn';
import { MEDIA_FORMAT_OPTIONS, type MediaFormat } from '../../../config/media';
import { POST_MAX_MEDIA } from '../../../config/posts';
import { useMediaLibrary } from '../../../hooks/use-media-library';
import type { MediaItem } from '../../../types/media';
import type { PostMedia } from '../../../types/post';

interface MediaPickerProps {
  open: boolean;
  alreadySelected: number;
  onClose: () => void;
  onInsert: (media: PostMedia[]) => void;
}

function toPostMedia(media: MediaItem, format: MediaFormat): PostMedia {
  return { id: media.id, url: media.url, type: media.type, format, alt: media.alt };
}

export function MediaPicker({ open, alreadySelected, onClose, onInsert }: MediaPickerProps) {
  const remaining = POST_MAX_MEDIA - alreadySelected;

  return (
    <Modal
      open={open}
      size="lg"
      title="Media Library"
      description={`Select or upload pictures (maximum ${remaining} at a time). You can also drag & drop pictures.`}
      onClose={onClose}
    >
      {open && (
        <MediaPickerBody
          remaining={remaining}
          onClose={onClose}
          onInsert={(media) => {
            onInsert(media);
            onClose();
          }}
        />
      )}
    </Modal>
  );
}

// Mounted only while the picker is open, so the library is fetched on demand
// and the selection starts empty every time.
function MediaPickerBody({
  remaining,
  onClose,
  onInsert,
}: {
  remaining: number;
  onClose: () => void;
  onInsert: (media: PostMedia[]) => void;
}) {
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<MediaItem[]>([]);
  const [format, setFormat] = useState<MediaFormat>('post');
  const { data, error, isLoading } = useMediaLibrary(page, '');
  const pages = data?.pages ?? 0;
  const hasVideo = selected.some((item) => item.type === 'video');

  function toggle(media: MediaItem) {
    setSelected((current) =>
      current.some((item) => item.id === media.id)
        ? current.filter((item) => item.id !== media.id)
        : current.length < remaining
          ? [...current, media]
          : current
    );
  }

  function chooseFormat(next: MediaFormat) {
    if (next === 'reel' && selected.length > 0 && !hasVideo) {
      return;
    }
    setFormat(next);
  }

  const pageNumbers =
    pages <= 1
      ? []
      : Array.from({ length: Math.min(pages, 6) }, (_, index) => index + 1);

  return (
    <>
      <div className="mb-4">
        <p className="text-muted-foreground mb-2 text-xs font-medium">Publish as</p>
        <div
          role="radiogroup"
          aria-label="Publish as"
          className="bg-surface-muted/50 flex w-fit flex-wrap gap-1 rounded-lg p-1"
        >
          {MEDIA_FORMAT_OPTIONS.map((option) => {
            const disabled = option.value === 'reel' && selected.length > 0 && !hasVideo;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={format === option.value}
                disabled={disabled}
                title={disabled ? 'Reels need a video. Select a video first.' : option.label}
                onClick={() => chooseFormat(option.value)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40',
                  format === option.value
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-surface-muted hover:text-foreground'
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      {error && !data ? (
        <p className="text-danger text-sm">Could not load media.</p>
      ) : isLoading && !data ? (
        <p className="text-muted-foreground text-sm">Loading media…</p>
      ) : data && data.results.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Your media library is empty. Upload files on the Media page first.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
          {data?.results.map((media) => {
            const isSelected = selected.some((item) => item.id === media.id);
            const order = selected.findIndex((item) => item.id === media.id) + 1;
            return (
              <button
                key={media.id}
                type="button"
                onClick={() => toggle(media)}
                aria-pressed={isSelected}
                aria-label={media.name}
                className={cn(
                  'bg-surface-muted relative aspect-square overflow-hidden rounded-lg border-2 transition',
                  isSelected ? 'border-primary' : 'hover:border-border border-transparent'
                )}
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
                    sizes="160px"
                    className="object-cover"
                  />
                )}
                {isSelected && (
                  <span className="bg-primary text-primary-foreground absolute right-1.5 bottom-1.5 flex size-6 items-center justify-center rounded-full text-xs font-semibold">
                    {order}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {pageNumbers.length > 0 && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-sm">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            className="text-muted-foreground hover:text-foreground disabled:opacity-40"
          >
            Previous
          </button>
          {pageNumbers.map((number) => (
            <button
              key={number}
              type="button"
              onClick={() => setPage(number)}
              className={cn(
                'flex size-8 items-center justify-center rounded-md font-medium transition',
                page === number
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-surface-muted hover:text-foreground'
              )}
            >
              {number}
            </button>
          ))}
          <button
            type="button"
            disabled={page >= pages}
            onClick={() => setPage(page + 1)}
            className="text-muted-foreground hover:text-foreground disabled:opacity-40"
          >
            Next &gt;
          </button>
        </div>
      )}

      <div className="mt-5 flex items-center justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button
          onClick={() => onInsert(selected.map((item) => toPostMedia(item, format)))}
          disabled={selected.length === 0 || (format === 'reel' && !hasVideo)}
        >
          Add selected media
        </Button>
      </div>
    </>
  );
}
