'use client';

import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Modal } from '@/shared/components/ui/modal';
import { TAG_DEFAULT_COLOR, TAG_NAME_MAX_LENGTH } from '../../config/settings';
import { saveTag } from '../../lib/settings.client';
import type { TagItem } from '../../types/settings';
import { TagChip } from './tag-chip';

interface TagDialogProps {
  open: boolean;
  /** Tag being edited, or null to add a new one. */
  tag: TagItem | null;
  onClose: () => void;
  onSaved: () => void;
}

export function TagDialog({ open, tag, onClose, onSaved }: TagDialogProps) {
  return (
    <Modal open={open} title={tag ? 'Edit tag' : 'Add tag'} onClose={onClose}>
      {open && <TagForm key={tag?.id ?? 'new'} tag={tag} onCancel={onClose} onSaved={onSaved} />}
    </Modal>
  );
}

interface TagFormProps {
  tag: TagItem | null;
  onCancel: () => void;
  onSaved: () => void;
}

function TagForm({ tag, onCancel, onSaved }: TagFormProps) {
  const [name, setName] = useState(tag?.name ?? '');
  const [color, setColor] = useState(tag?.color ?? TAG_DEFAULT_COLOR);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setSaving(true);
    try {
      await saveTag({ name, color }, tag?.id);
      onSaved();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save the tag');
      setSaving(false);
    }
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <div className="flex items-end gap-3">
        <label className="flex-1 space-y-1.5 text-sm font-medium">
          <span>Name</span>
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={TAG_NAME_MAX_LENGTH}
            placeholder="e.g. Product launch"
          />
        </label>
        <label className="space-y-1.5 text-sm font-medium">
          <span>Colour</span>
          <input
            type="color"
            value={color}
            onChange={(event) => setColor(event.target.value)}
            className="border-border bg-surface block h-10 w-14 cursor-pointer rounded-lg border p-1"
          />
        </label>
      </div>
      {name.trim() && (
        <p className="text-muted-foreground flex items-center gap-2 text-sm">
          Preview: <TagChip tag={{ id: 'preview', name: name.trim(), color }} />
        </p>
      )}

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
        <Button type="submit" disabled={saving || !name.trim()}>
          {saving ? 'Saving…' : 'Save tag'}
        </Button>
      </div>
    </form>
  );
}
