'use client';

import dayjs from 'dayjs';
import { cn } from '@/shared/lib/cn';
import { POST_DRAG_TYPE, type DraggedPost } from '../../lib/calendar';
import type { PostListItem, PostState } from '../../types/post';
import { ChannelAvatar } from '../channels/channel-avatar';

const stateBorder: Record<PostState, string> = {
  draft: 'border-l-muted-foreground',
  queue: 'border-l-primary',
  published: 'border-l-success',
  error: 'border-l-danger',
};

const stateLabel: Record<PostState, string> = {
  draft: 'Draft',
  queue: 'Scheduled',
  published: 'Published',
  error: 'Failed',
};

interface CalendarPostChipProps {
  post: PostListItem;
  onOpen: (post: PostListItem) => void;
}

export function CalendarPostChip({ post, onOpen }: CalendarPostChipProps) {
  const movable = post.state !== 'published';
  const time = dayjs(post.publishDate).format('HH:mm');

  return (
    <button
      type="button"
      draggable={movable}
      onDragStart={(event) => {
        const payload: DraggedPost = { group: post.group, publishDate: post.publishDate };
        event.dataTransfer.setData(POST_DRAG_TYPE, JSON.stringify(payload));
        event.dataTransfer.effectAllowed = 'move';
      }}
      onClick={() => onOpen(post)}
      title={`${stateLabel[post.state]} · ${post.channel.name} · ${time}\n${post.content}`}
      className={cn(
        'border-border bg-surface hover:bg-surface-muted flex w-full items-center gap-1.5 rounded-md border border-l-4 px-1.5 py-1 text-left text-xs transition',
        stateBorder[post.state],
        movable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
      )}
    >
      <ChannelAvatar name={post.channel.name} picture={post.channel.picture} size="xs" />
      <span className="text-muted-foreground shrink-0 tabular-nums">{time}</span>
      <span className="truncate">{post.content || 'Media only'}</span>
    </button>
  );
}
