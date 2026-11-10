'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';

interface PortalApprovalActionsProps {
  group: string;
  initialNotes?: { at: string; text: string }[];
}

export function PortalApprovalActions({ group, initialNotes = [] }: PortalApprovalActionsProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [notes, setNotes] = useState(initialNotes);

  async function decide(action: 'approve' | 'reject' | 'note') {
    if (action === 'reject' && note.trim().length < 2) {
      setError('Tell us what to change before requesting an edit.');
      return;
    }
    if (action === 'note' && note.trim().length < 2) {
      setError('Write a short note first.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/approver/posts/${group}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          action === 'note'
            ? { action: 'note', note: note.trim() }
            : { action, reason: note.trim() || undefined }
        ),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        notes?: { at: string; text: string }[];
      };
      if (!response.ok) {
        throw new Error(payload.error || 'Could not update approval');
      }
      if (action === 'note' && payload.notes) {
        setNotes(payload.notes);
        setNote('');
      } else {
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update approval');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-auto space-y-3 border-t border-gray-100 pt-4">
      {notes.length > 0 ? (
        <ul className="space-y-2 rounded-lg bg-gray-50 p-3">
          {notes.map((entry) => (
            <li key={`${entry.at}-${entry.text.slice(0, 12)}`} className="text-xs text-gray-600">
              <span className="font-medium text-gray-800">Your note · </span>
              {new Date(entry.at).toLocaleString()}
              <p className="mt-0.5 whitespace-pre-wrap text-sm text-gray-700">{entry.text}</p>
            </li>
          ))}
        </ul>
      ) : null}

      <label className="block text-xs font-medium text-gray-600">
        Note for your agency (optional on approve)
        <textarea
          className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          rows={2}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="e.g. Swap the headline, keep the photo"
          maxLength={2000}
        />
      </label>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          variant="secondary"
          className="flex-1"
          disabled={busy}
          onClick={() => void decide('note')}
        >
          Leave note
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="flex-1"
          disabled={busy}
          onClick={() => void decide('reject')}
        >
          Request edit
        </Button>
        <Button type="button" className="flex-1" disabled={busy} onClick={() => void decide('approve')}>
          Approve
        </Button>
      </div>
    </div>
  );
}
