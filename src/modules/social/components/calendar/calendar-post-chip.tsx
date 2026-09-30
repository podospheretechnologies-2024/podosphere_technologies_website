'use client';

import { CalendarClock, Copy, Eye, Trash2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';
import { POST_DRAG_TYPE, type DraggedPost } from '../../lib/calendar';
import type { MediaFormat } from '../../types/media';
import type { PostListItem, PostState } from '../../types/post';
import { ChannelAvatar } from '../channels/channel-avatar';
import { ProviderMark } from '../channels/provider-mark';

const topBarByState: Record<PostState, string> = {
  draft: 'bg-muted-foreground',
  queue: 'bg-primary',
  published: 'bg-success',
  error: 'bg-danger',
};

const stateLabel: Record<PostState, string> = {
  draft: 'Draft',
  queue: 'Scheduled',
  published: 'Published',
  error: 'Failed',
};

const formatLabel: Partial<Record<MediaFormat, string>> = {
  reel: 'Reel',
  story: 'Story',
};

interface CalendarPostChipProps {
  post: PostListItem;
  onOpen: (post: PostListItem) => void;
  onDelete?: (post: PostListItem) => void;
}

export function CalendarPostChip({ post, onOpen, onDelete }: CalendarPostChipProps) {
  const [hover, setHover] = useState(false);
  const movable = post.state !== 'published';
  const mediaFormat = post.media.find((item) => item.format && item.format !== 'post')?.format;
  const label = formatLabel[mediaFormat ?? 'post'];
  const previewText = post.content.trim() || (label ? label : 'Media only');

  return (
    <div
      className="group relative"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {hover && (
        <div className="bg-surface border-border absolute -top-8 left-1/2 z-20 flex -translate-x-1/2 items-center gap-0.5 rounded-md border px-1 py-0.5 shadow-lg">
          <ChipAction
            label="Edit"
            onClick={() => onOpen(post)}
            icon={<CalendarClock className="size-3.5" />}
          />
          <ChipAction
            label="Preview"
            onClick={() => {
              if (post.releaseUrl) {
                window.open(post.releaseUrl, '_blank', 'noopener,noreferrer');
              } else {
                onOpen(post);
              }
            }}
            icon={<Eye className="size-3.5" />}
          />
          <ChipAction
            label="Duplicate"
            onClick={() => onOpen(post)}
            icon={<Copy className="size-3.5" />}
          />
          {onDelete && post.state !== 'published' && (
            <ChipAction
              label="Delete"
              onClick={() => onDelete(post)}
              icon={<Trash2 className="size-3.5" />}
              danger
            />
          )}
        </div>
      )}

      <button
        type="button"
        draggable={movable}
        onDragStart={(event) => {
          const payload: DraggedPost = { group: post.group, publishDate: post.publishDate };
          event.dataTransfer.setData(POST_DRAG_TYPE, JSON.stringify(payload));
          event.dataTransfer.effectAllowed = 'move';
        }}
        onClick={() => onOpen(post)}
        title={`${stateLabel[post.state]}${label ? ` · ${label}` : ''} · ${post.channel.name}\n${previewText}`}
        className={cn(
          'bg-surface border-border flex w-full flex-col overflow-hidden rounded-md border text-left shadow-sm transition',
          hover && 'border-primary ring-primary/40 ring-1',
          movable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
        )}
      >
        <span className={cn('h-1.5 w-full shrink-0', topBarByState[post.state])} />
        <span className="flex min-w-0 items-center gap-1.5 px-1.5 py-1">
          <span className="relative shrink-0">
            <ChannelAvatar name={post.channel.name} picture={post.channel.picture} size="xs" />
            <ProviderMark
              identifier={post.channel.providerIdentifier}
              name={post.channel.providerName}
              size="sm"
              className="ring-surface absolute -right-1 -bottom-1 size-3 ring-1"
            />
          </span>
          <span className="min-w-0 flex-1 truncate text-[11px] leading-tight text-white">
            {post.content.trim()
              ? previewText
              : label
                ? label
                : 'Media only'}
          </span>
        </span>
      </button>
    </div>
  );
}

function ChipAction({
  label,
  icon,
  onClick,
  danger,
}: {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className={cn(
        'rounded p-1 transition',
        danger
          ? 'text-danger hover:bg-danger/15'
          : 'text-primary hover:bg-primary/15'
      )}
    >
      {icon}
    </button>
  );
}
