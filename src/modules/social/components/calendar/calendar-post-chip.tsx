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

const sideBarByState: Record<PostState, string> = {
  draft: 'border-l-muted-foreground',
  queue: 'border-l-primary',
  published: 'border-l-success',
  error: 'border-l-danger',
};

const stateTone: Record<PostState, string> = {
  draft: 'bg-surface-muted text-muted-foreground',
  queue: 'bg-primary/15 text-primary',
  published: 'bg-success/15 text-success',
  error: 'bg-danger/15 text-danger',
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
  /** Day view uses a roomier card; week/month keep the compact chip. */
  variant?: 'compact' | 'day';
}

export function CalendarPostChip({
  post,
  onOpen,
  onDelete,
  variant = 'compact',
}: CalendarPostChipProps) {
  const [hover, setHover] = useState(false);
  const movable = post.state !== 'published';
  const mediaFormat = post.media.find((item) => item.format && item.format !== 'post')?.format;
  const label = formatLabel[mediaFormat ?? 'post'];
  const previewText = post.content.trim() || (label ? label : 'Media only');
  const isDay = variant === 'day';

  return (
    <div
      className={cn('group relative', isDay && 'max-w-xl')}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {hover && (
        <div className="border-border bg-surface absolute -top-9 left-1/2 z-30 flex -translate-x-1/2 items-center gap-0.5 rounded-lg border px-1 py-1 shadow-xl">
          <ChipAction
            label={post.state === 'published' ? 'View' : 'Edit'}
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
          {onDelete && (
            <>
              <span aria-hidden className="bg-border mx-0.5 h-4 w-px" />
              <ChipAction
                label="Delete"
                onClick={() => onDelete(post)}
                icon={<Trash2 className="size-3.5" />}
                danger
              />
            </>
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
          'bg-surface border-border flex w-full overflow-hidden border text-left shadow-sm transition',
          isDay
            ? cn('rounded-xl border-l-4', sideBarByState[post.state])
            : 'flex-col rounded-lg',
          hover && 'border-primary ring-primary/30 shadow-md ring-1',
          movable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
        )}
      >
        {!isDay && <span className={cn('h-1.5 w-full shrink-0', topBarByState[post.state])} />}
        <span
          className={cn(
            'flex min-w-0 items-start gap-2',
            isDay ? 'px-3 py-2.5' : 'items-center gap-1.5 px-2 py-1.5'
          )}
        >
          <span className="relative shrink-0">
            <ChannelAvatar
              name={post.channel.name}
              picture={post.channel.picture}
              size={isDay ? 'sm' : 'xs'}
            />
            <ProviderMark
              identifier={post.channel.providerIdentifier}
              name={post.channel.providerName}
              size="sm"
              className={cn(
                'ring-surface absolute ring-1',
                isDay ? '-right-0.5 -bottom-0.5 size-3.5' : '-right-1 -bottom-1 size-3'
              )}
            />
          </span>
          <span className="min-w-0 flex-1">
            {isDay ? (
              <>
                <span className="mb-1 flex flex-wrap items-center gap-1.5">
                  <span className="text-foreground truncate text-xs font-semibold">
                    {post.channel.name}
                  </span>
                  <span
                    className={cn(
                      'rounded-md px-1.5 py-0.5 text-[10px] font-semibold',
                      stateTone[post.state]
                    )}
                  >
                    {stateLabel[post.state]}
                    {label ? ` · ${label}` : ''}
                  </span>
                </span>
                <span className="text-muted-foreground line-clamp-2 text-xs leading-snug">
                  {previewText}
                </span>
              </>
            ) : (
              <>
                <span className="text-foreground block truncate text-[11px] leading-tight font-medium">
                  {previewText}
                </span>
                <span className="text-muted-foreground block truncate text-[10px] leading-tight">
                  {stateLabel[post.state]}
                  {label ? ` · ${label}` : ''}
                </span>
              </>
            )}
          </span>
        </span>
      </button>

      {hover && (
        <div className="border-border bg-surface text-muted-foreground pointer-events-none absolute top-full right-0 z-20 mt-1 max-w-[220px] rounded-md border px-2 py-1 text-[10px] shadow-lg">
          <p className="text-foreground font-medium">
            {stateLabel[post.state]} · {post.channel.name}
          </p>
          <p className="mt-0.5 line-clamp-2">{previewText}</p>
        </div>
      )}
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
        'rounded-md p-1.5 transition',
        danger ? 'text-danger hover:bg-danger/15' : 'text-primary hover:bg-primary/15'
      )}
    >
      {icon}
    </button>
  );
}
