'use client';

import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Modal } from '@/shared/components/ui/modal';
import { SIGNATURE_MAX_LENGTH } from '../../config/settings';
import { saveSignature } from '../../lib/settings.client';
import type { SignatureItem } from '../../types/settings';

interface SignatureDialogProps {
  open: boolean;
  /** Signature being edited, or null to add a new one. */
  signature: SignatureItem | null;
  onClose: () => void;
  onSaved: () => void;
}

export function SignatureDialog({ open, signature, onClose, onSaved }: SignatureDialogProps) {
  return (
    <Modal
      open={open}
      title={signature ? 'Edit signature' : 'Add signature'}
      description="Text you can add to the end of a post, like a call to action or hashtags."
      onClose={onClose}
    >
      {open && (
        <SignatureForm
          key={signature?.id ?? 'new'}
          signature={signature}
          onCancel={onClose}
          onSaved={onSaved}
        />
      )}
    </Modal>
  );
}

interface SignatureFormProps {
  signature: SignatureItem | null;
  onCancel: () => void;
  onSaved: () => void;
}

function SignatureForm({ signature, onCancel, onSaved }: SignatureFormProps) {
  const [content, setContent] = useState(signature?.content ?? '');
  const [autoAdd, setAutoAdd] = useState(signature?.autoAdd ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setSaving(true);
    try {
      await saveSignature({ content, autoAdd }, signature?.id);
      onSaved();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save the signature');
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <textarea
        value={content}
        onChange={(event) => setContent(event.target.value)}
        maxLength={SIGNATURE_MAX_LENGTH}
        rows={5}
        placeholder={'Thanks for reading!\n#podosphere'}
        aria-label="Signature text"
        className="border-border placeholder:text-muted-foreground block w-full resize-y rounded-lg border bg-transparent p-3 text-sm outline-none"
      />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={autoAdd}
          onChange={(event) => setAutoAdd(event.target.checked)}
          className="accent-primary size-4"
        />
        Add automatically to every new post
      </label>

      {error && (
        <div
          role="alert"
          className="border-danger/40 bg-danger/10 text-danger rounded-lg border p-3 text-sm"
        >
          {error}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={saving || !content.trim()}>
          {saving ? 'Saving…' : 'Save signature'}
        </Button>
      </div>
    </div>
  );
}
