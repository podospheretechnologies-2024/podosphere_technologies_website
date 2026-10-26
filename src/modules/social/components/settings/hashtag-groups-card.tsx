'use client';

import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { useHashtagGroups } from '../../hooks/use-settings';
import { deleteHashtagGroup } from '../../lib/settings.client';
import type { HashtagGroupItem } from '../../types/settings';
import { HashtagGroupDialog } from './hashtag-group-dialog';

type DialogState = { open: false } | { open: true; group: HashtagGroupItem | null };

export function HashtagGroupsCard() {
  const { data, error, mutate } = useHashtagGroups();
  const [dialog, setDialog] = useState<DialogState>({ open: false });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function remove(group: HashtagGroupItem) {
    if (!window.confirm(`Delete the hashtag group "${group.name}"?`)) {
      return;
    }
    setActionError(null);
    setBusyId(group.id);
    try {
      await deleteHashtagGroup(group.id);
      await mutate();
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
          <h2 className="text-base font-semibold">Hashtag groups</h2>
          <p className="text-muted-foreground text-sm">
            Saved sets of hashtags you can drop into any post from the composer.
          </p>
        </div>
        <Button size="sm" onClick={() => setDialog({ open: true, group: null })}>
          Add group
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
          {error instanceof Error ? error.message : 'Could not load hashtag groups'}
        </p>
      ) : !data ? (
        <p className="text-muted-foreground text-sm">Loading hashtag groups…</p>
      ) : data.length === 0 ? (
        <p className="text-muted-foreground text-sm">No hashtag groups yet.</p>
      ) : (
        <ul className="divide-border divide-y">
          {data.map((group) => (
            <li key={group.id} className="flex items-start justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-medium">{group.name}</p>
                <p className="text-muted-foreground truncate text-sm">{group.hashtags}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busyId === group.id}
                  onClick={() => setDialog({ open: true, group })}
                >
                  Edit
                </Button>
                <Button
                  variant="danger-ghost"
                  size="sm"
                  disabled={busyId === group.id}
                  onClick={() => remove(group)}
                >
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <HashtagGroupDialog
        open={dialog.open}
        group={dialog.open ? dialog.group : null}
        onClose={() => setDialog({ open: false })}
        onSaved={() => {
          setDialog({ open: false });
          void mutate();
        }}
      />
    </Card>
  );
}
