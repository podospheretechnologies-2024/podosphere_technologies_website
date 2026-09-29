'use client';

import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { MEDIA_FORMAT_OPTIONS } from '../../config/media';
import { formatFileSize } from '../../lib/media.client';
import type { MediaItem } from '../../types/media';
import { InstagramFrame } from './instagram-frames';

interface MediaCardProps {
  media: MediaItem;
  accountName: string;
  deleting: boolean;
  onPreview: (media: MediaItem) => void;
  onDelete: (media: MediaItem) => void;
}

export function MediaCard({ media, accountName, deleting, onPreview, onDelete }: MediaCardProps) {
  const [hovered, setHovered] = useState(false);
  const formatLabel = MEDIA_FORMAT_OPTIONS.find((option) => option.value === media.format)?.label;

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => onPreview(media)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
        aria-label={`Preview ${media.name}`}
        className="focus-visible:outline-primary block w-full rounded-xl text-left focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <InstagramFrame media={media} accountName={accountName} active={hovered} />
      </button>
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium" title={media.name}>
            {media.name}
          </p>
          <p className="text-muted-foreground text-xs">
            {formatLabel} · {formatFileSize(media.fileSize)}
          </p>
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
