'use client';

import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { useTags } from '../../hooks/use-settings';
import { revalidatePosts } from '../../lib/posts.client';
import { deleteTag } from '../../lib/settings.client';
import type { TagItem } from '../../types/settings';
import { TagChip } from './tag-chip';
import { TagDialog } from './tag-dialog';

type DialogState = { open: false } | { open: true; tag: TagItem | null };

export function TagsCard() {
  const { data, error, mutate } = useTags();
  const [dialog, setDialog] = useState<DialogState>({ open: false });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function remove(tag: TagItem) {
    if (!window.confirm(`Delete the tag "${tag.name}"? It will be removed from every post.`)) {
      return;
    }
    setActionError(null);
    setBusyId(tag.id);
    try {
      await deleteTag(tag.id);
      await Promise.all([mutate(), revalidatePosts()]);
    } catch (deleteError) {
      setActionError(deleteError instanceof Error ? deleteError.message : 'Could not delete');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Tags</h2>
          <p className="text-muted-foreground text-sm">
            Colour-coded labels to group posts by campaign, client or topic.
          </p>
        </div>
        <Button size="sm" onClick={() => setDialog({ open: true, tag: null })}>
          Add tag
        </Button>
      </div>

      {actionError && (
        <div
          role="alert"
          className="border-danger/40 bg-danger/10 text-danger rounded-lg border p-3 text-sm"
        >
          {actionError}
        </div>
      )}

      {error && !data ? (
        <p className="text-danger text-sm">
          {error instanceof Error ? error.message : 'Could not load tags'}
        </p>
      ) : !data ? (
        <p className="text-muted-foreground text-sm">Loading tags…</p>
      ) : data.length === 0 ? (
        <p className="text-muted-foreground text-sm">No tags yet.</p>
      ) : (
        <ul className="divide-border divide-y">
          {data.map((tag) => (
            <li key={tag.id} className="flex items-center justify-between gap-3 py-2">
              <TagChip tag={tag} />
              <div className="flex shrink-0 gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busyId === tag.id}
                  onClick={() => setDialog({ open: true, tag })}
                >
                  Edit
                </Button>
                <Button
                  variant="danger-ghost"
                  size="sm"
                  disabled={busyId === tag.id}
                  onClick={() => remove(tag)}
                >
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <TagDialog
        open={dialog.open}
        tag={dialog.open ? dialog.tag : null}
        onClose={() => setDialog({ open: false })}
        onSaved={() => {
          setDialog({ open: false });
          void Promise.all([mutate(), revalidatePosts()]);
        }}
      />
    </Card>
  );
}
