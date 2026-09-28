'use client';

import Image from 'next/image';
import { Button } from '@/shared/components/ui/button';
import { formatFileSize } from '../../lib/media.client';
import type { MediaItem } from '../../types/media';

interface MediaCardProps {
  media: MediaItem;
  deleting: boolean;
  onDelete: (media: MediaItem) => void;
}

export function MediaCard({ media, deleting, onDelete }: MediaCardProps) {
  return (
    <div className="group border-border bg-surface overflow-hidden rounded-xl border">
      <div className="bg-surface-muted relative aspect-square">
        {media.type === 'video' ? (
          <video
            src={media.url}
            className="h-full w-full object-cover"
            preload="metadata"
            muted
            playsInline
            controls
          />
        ) : (
          <Image
            src={media.url}
            alt={media.alt ?? media.name}
            fill
            unoptimized
            sizes="(min-width: 1280px) 16vw, (min-width: 640px) 33vw, 50vw"
            className="object-cover"
          />
        )}
        {media.type === 'video' && (
          <span className="absolute top-2 left-2 rounded-md bg-black/70 px-2 py-0.5 text-xs font-medium text-white">
            Video
          </span>
        )}
      </div>
      <div className="flex items-center justify-between gap-2 p-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium" title={media.name}>
            {media.name}
          </p>
          <p className="text-muted-foreground text-xs">{formatFileSize(media.fileSize)}</p>
        </div>
        <Button
          variant="danger-ghost"
          size="sm"
          className="shrink-0"
          disabled={deleting}
          onClick={() => onDelete(media)}
          aria-label={`Delete ${media.name}`}
        >
          {deleting ? '…' : 'Delete'}
        </Button>
      </div>
    </div>
  );
}
