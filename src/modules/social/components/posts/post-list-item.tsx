'use client';

import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/cn';
import { formatPostDate } from '../../lib/posts.client';
import type { PostListItem as PostListItemData, PostState } from '../../types/post';
import { ChannelAvatar } from '../channels/channel-avatar';

const stateStyles: Record<PostState, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-surface-muted text-muted-foreground' },
  queue: { label: 'Scheduled', className: 'bg-primary/10 text-primary' },
  published: { label: 'Published', className: 'bg-success/10 text-success' },
  error: { label: 'Failed', className: 'bg-danger/10 text-danger' },
};

interface PostListItemProps {
  post: PostListItemData;
  busy: boolean;
  onEdit: (group: string) => void;
  onDelete: (post: PostListItemData) => void;
}

export function PostListItem({ post, busy, onEdit, onDelete }: PostListItemProps) {
  const state = stateStyles[post.state];
  const extras = [
    post.media.length > 0 && `${post.media.length} media`,
    post.commentsCount > 0 && `${post.commentsCount} comment${post.commentsCount === 1 ? '' : 's'}`,
  ].filter(Boolean);

  return (
    <li className="border-border bg-surface flex gap-4 rounded-xl border p-4">
      <ChannelAvatar name={post.channel.name} picture={post.channel.picture} />
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <span className="font-medium">{post.channel.name}</span>
          <span className="text-muted-foreground">{post.channel.providerName}</span>
          <span className="text-muted-foreground">·</span>
          <time dateTime={post.publishDate} className="text-muted-foreground">
            {formatPostDate(post.publishDate)}
          </time>
          <span className={cn('rounded-md px-2 py-0.5 font-medium', state.className)}>
            {state.label}
          </span>
        </div>
        <p className="line-clamp-2 text-sm break-words whitespace-pre-line">
          {post.content || <span className="text-muted-foreground italic">Media only</span>}
        </p>
        {extras.length > 0 && <p className="text-muted-foreground text-xs">{extras.join(' · ')}</p>}
        {post.error && <p className="text-danger text-xs">{post.error}</p>}
        {post.releaseUrl && (
          <a
            href={post.releaseUrl}
            target="_blank"
            rel="noreferrer"
            className="text-primary text-xs font-medium hover:underline"
          >
            View published post
          </a>
        )}
      </div>
      <div className="flex shrink-0 items-start gap-1">
        {post.state !== 'published' && (
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => onEdit(post.group)}>
            Edit
          </Button>
        )}
        <Button
          variant="danger-ghost"
          size="sm"
          disabled={busy}
          onClick={() => onDelete(post)}
          aria-label={`Delete post for ${post.channel.name}`}
        >
          Delete
        </Button>
      </div>
    </li>
  );
}
