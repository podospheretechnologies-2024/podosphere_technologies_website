'use client';

import Image from 'next/image';
import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Modal } from '@/shared/components/ui/modal';
import { cn } from '@/shared/lib/cn';
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

function toPostMedia(media: MediaItem): PostMedia {
  return { id: media.id, url: media.url, type: media.type, alt: media.alt };
}

export function MediaPicker({ open, alreadySelected, onClose, onInsert }: MediaPickerProps) {
  const remaining = POST_MAX_MEDIA - alreadySelected;

  return (
    <Modal
      open={open}
      title="Insert media"
      description={`Pick up to ${remaining} file${remaining === 1 ? '' : 's'} from your media library.`}
      onClose={onClose}
    >
      {open && (
        <MediaPickerBody
          remaining={remaining}
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
  onInsert,
}: {
  remaining: number;
  onInsert: (media: PostMedia[]) => void;
}) {
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<MediaItem[]>([]);
  const { data, error, isLoading } = useMediaLibrary(page, '');
  const pages = data?.pages ?? 0;

  function toggle(media: MediaItem) {
    setSelected((current) =>
      current.some((item) => item.id === media.id)
        ? current.filter((item) => item.id !== media.id)
        : current.length < remaining
          ? [...current, media]
          : current
    );
  }

  return (
    <>
      {error && !data ? (
        <p className="text-danger text-sm">Could not load media.</p>
      ) : isLoading && !data ? (
        <p className="text-muted-foreground text-sm">Loading media…</p>
      ) : data && data.results.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Your media library is empty. Upload files on the Media page first.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {data?.results.map((media) => {
            const isSelected = selected.some((item) => item.id === media.id);
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
                  <span className="bg-primary text-primary-foreground absolute top-1.5 right-1.5 flex size-6 items-center justify-center rounded-full text-xs font-semibold">
                    {selected.findIndex((item) => item.id === media.id) + 1}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {pages > 1 && (
            <>
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= pages}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </>
          )}
        </div>
        <Button
          onClick={() => onInsert(selected.map(toPostMedia))}
          disabled={selected.length === 0}
        >
          Insert {selected.length > 0 && `(${selected.length})`}
        </Button>
      </div>
    </>
  );
}
