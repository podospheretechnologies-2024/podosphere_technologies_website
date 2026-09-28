'use client';

import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { useSignatures } from '../../hooks/use-settings';
import { deleteSignature } from '../../lib/settings.client';
import type { SignatureItem } from '../../types/settings';
import { SignatureDialog } from './signature-dialog';

type DialogState = { open: false } | { open: true; signature: SignatureItem | null };

export function SignaturesCard() {
  const { data, error, mutate } = useSignatures();
  const [dialog, setDialog] = useState<DialogState>({ open: false });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function remove(signature: SignatureItem) {
    if (!window.confirm('Delete this signature?')) {
      return;
    }
    setActionError(null);
    setBusyId(signature.id);
    try {
      await deleteSignature(signature.id);
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
          <h2 className="text-base font-semibold">Signatures</h2>
          <p className="text-muted-foreground text-sm">
            Reusable endings for your posts. One of them can be added to new posts automatically.
          </p>
        </div>
        <Button size="sm" onClick={() => setDialog({ open: true, signature: null })}>
          Add signature
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
          {error instanceof Error ? error.message : 'Could not load signatures'}
        </p>
      ) : !data ? (
        <p className="text-muted-foreground text-sm">Loading signatures…</p>
      ) : data.length === 0 ? (
        <p className="text-muted-foreground text-sm">No signatures yet.</p>
      ) : (
        <ul className="space-y-2">
          {data.map((signature) => (
            <li
              key={signature.id}
              className="border-border flex items-start gap-3 rounded-lg border p-3"
            >
              <div className="min-w-0 flex-1 space-y-1">
                <p className="line-clamp-3 text-sm break-words whitespace-pre-line">
                  {signature.content}
                </p>
                {signature.autoAdd && (
                  <span className="bg-primary/10 text-primary inline-block rounded-md px-2 py-0.5 text-xs font-medium">
                    Added automatically
                  </span>
                )}
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busyId === signature.id}
                  onClick={() => setDialog({ open: true, signature })}
                >
                  Edit
                </Button>
                <Button
                  variant="danger-ghost"
                  size="sm"
                  disabled={busyId === signature.id}
                  onClick={() => remove(signature)}
                >
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <SignatureDialog
        open={dialog.open}
        signature={dialog.open ? dialog.signature : null}
        onClose={() => setDialog({ open: false })}
        onSaved={() => {
          setDialog({ open: false });
          void mutate();
        }}
      />
    </Card>
  );
}
