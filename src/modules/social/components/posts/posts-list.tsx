'use client';

import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { cn } from '@/shared/lib/cn';
import {
  POST_LIST_FILTER_LABELS,
  POST_LIST_FILTER_VALUES,
  type PostListFilter,
} from '../../config/posts';
import { usePostsList } from '../../hooks/use-posts';
import { deletePostGroup } from '../../lib/posts.client';
import type { PostListItem as PostListItemData } from '../../types/post';
import { PostComposer } from './composer/post-composer';
import { PostListItem } from './post-list-item';

type ComposerState = { open: false } | { open: true; group: string | null };

const emptyMessages: Record<PostListFilter, string> = {
  all: 'No upcoming posts. Create one to fill your calendar.',
  scheduled: 'Nothing is scheduled right now.',
  draft: 'No drafts saved.',
  published: 'Nothing has been published yet.',
  error: 'No failed posts. Nice!',
};

export function PostsList() {
  const [filter, setFilter] = useState<PostListFilter>('all');
  const [page, setPage] = useState(1);
  const [composer, setComposer] = useState<ComposerState>({ open: false });
  const [busyGroup, setBusyGroup] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, error, isLoading, mutate } = usePostsList(page, filter);
  const pages = data?.pages ?? 0;

  function changeFilter(next: PostListFilter) {
    setFilter(next);
    setPage(1);
  }

  async function handleDelete(post: PostListItemData) {
    if (
      !window.confirm('Delete this post? It is removed from every channel it was scheduled for.')
    ) {
      return;
    }

    setActionError(null);
    setBusyGroup(post.group);
    try {
      await deletePostGroup(post.group);
      await mutate();
    } catch (deleteError) {
      setActionError(deleteError instanceof Error ? deleteError.message : 'Delete failed');
    } finally {
      setBusyGroup(null);
    }
  }

  function handleSaved() {
    setComposer({ open: false });
    void mutate();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div role="tablist" aria-label="Filter posts" className="flex flex-wrap gap-1">
          {POST_LIST_FILTER_VALUES.map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={filter === value}
              onClick={() => changeFilter(value)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-sm font-medium transition',
                filter === value
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-surface-muted hover:text-foreground'
              )}
            >
              {POST_LIST_FILTER_LABELS[value]}
            </button>
          ))}
        </div>
        <Button className="ml-auto" onClick={() => setComposer({ open: true, group: null })}>
          Create post
        </Button>
      </div>

      {actionError && (
        <div
          role="alert"
          className="border-danger/40 bg-danger/10 text-danger rounded-lg border p-4 text-sm"
        >
          {actionError}
        </div>
      )}

      {error && !data ? (
        <EmptyState
          title="Could not load posts"
          description={error instanceof Error ? error.message : undefined}
          action={<Button onClick={() => mutate()}>Try again</Button>}
        />
      ) : isLoading && !data ? (
        <p className="text-muted-foreground text-sm">Loading posts…</p>
      ) : data && data.results.length === 0 ? (
        <EmptyState title="No posts here" description={emptyMessages[filter]} />
      ) : (
        <ul className="space-y-3">
          {data?.results.map((post) => (
            <PostListItem
              key={post.id}
              post={post}
              busy={busyGroup === post.group}
              onEdit={(group) => setComposer({ open: true, group })}
              onDelete={handleDelete}
            />
          ))}
        </ul>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </Button>
          <span className="text-muted-foreground text-sm">
            Page {page} of {pages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={page >= pages}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </div>
      )}

      <PostComposer
        open={composer.open}
        group={composer.open ? composer.group : null}
        onClose={() => setComposer({ open: false })}
        onSaved={handleSaved}
      />
    </div>
  );
}
