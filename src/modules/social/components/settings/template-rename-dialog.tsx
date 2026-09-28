'use client';

import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Modal } from '@/shared/components/ui/modal';
import { TEMPLATE_NAME_MAX_LENGTH } from '../../config/settings';
import { renameTemplate } from '../../lib/settings.client';
import type { TemplateItem } from '../../types/settings';

interface TemplateRenameDialogProps {
  template: TemplateItem | null;
  onClose: () => void;
  onSaved: () => void;
}

export function TemplateRenameDialog({ template, onClose, onSaved }: TemplateRenameDialogProps) {
  return (
    <Modal open={template !== null} title="Rename template" onClose={onClose}>
      {template && (
        <RenameForm key={template.id} template={template} onCancel={onClose} onSaved={onSaved} />
      )}
    </Modal>
  );
}

interface RenameFormProps {
  template: TemplateItem;
  onCancel: () => void;
  onSaved: () => void;
}

function RenameForm({ template, onCancel, onSaved }: RenameFormProps) {
  const [name, setName] = useState(template.name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setSaving(true);
    try {
      await renameTemplate(template.id, name);
      onSaved();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not rename the template');
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
      <Input
        value={name}
        onChange={(event) => setName(event.target.value)}
        maxLength={TEMPLATE_NAME_MAX_LENGTH}
        aria-label="Template name"
      />
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
          {saving ? 'Saving…' : 'Rename'}
        </Button>
      </div>
    </form>
  );
}
