'use client';

import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Modal } from '@/shared/components/ui/modal';
import {
  HASHTAG_GROUP_BODY_MAX_LENGTH,
  HASHTAG_GROUP_NAME_MAX_LENGTH,
} from '../../config/settings';
import { saveHashtagGroup } from '../../lib/settings.client';
import type { HashtagGroupItem } from '../../types/settings';

interface HashtagGroupDialogProps {
  open: boolean;
  /** Group being edited, or null to add a new one. */
  group: HashtagGroupItem | null;
  onClose: () => void;
  onSaved: () => void;
}

export function HashtagGroupDialog({ open, group, onClose, onSaved }: HashtagGroupDialogProps) {
  return (
    <Modal open={open} title={group ? 'Edit hashtag group' : 'Add hashtag group'} onClose={onClose}>
      {open && (
        <HashtagGroupForm key={group?.id ?? 'new'} group={group} onCancel={onClose} onSaved={onSaved} />
      )}
    </Modal>
  );
}

interface HashtagGroupFormProps {
  group: HashtagGroupItem | null;
  onCancel: () => void;
  onSaved: () => void;
}

function HashtagGroupForm({ group, onCancel, onSaved }: HashtagGroupFormProps) {
  const [name, setName] = useState(group?.name ?? '');
  const [hashtags, setHashtags] = useState(group?.hashtags ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setSaving(true);
    try {
      await saveHashtagGroup({ name, hashtags }, group?.id);
      onSaved();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save the group');
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
      <label className="block space-y-1.5 text-sm font-medium">
        <span>Name</span>
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={HASHTAG_GROUP_NAME_MAX_LENGTH}
          placeholder="e.g. Diwali sale"
        />
      </label>

      <label className="block space-y-1.5 text-sm font-medium">
        <span>Hashtags</span>
        <textarea
          value={hashtags}
          onChange={(event) => setHashtags(event.target.value)}
          maxLength={HASHTAG_GROUP_BODY_MAX_LENGTH}
          rows={4}
          placeholder="#diwali #sale #festiveoffers"
          className="border-border bg-surface focus:border-primary w-full rounded-lg border px-3 py-2 text-sm outline-none"
        />
        <span className="text-muted-foreground block text-xs font-normal">
          Separate with spaces or commas. The “#” is added for you.
        </span>
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
        <Button type="submit" disabled={saving || !name.trim() || !hashtags.trim()}>
          {saving ? 'Saving…' : 'Save group'}
        </Button>
      </div>
    </form>
  );
}
