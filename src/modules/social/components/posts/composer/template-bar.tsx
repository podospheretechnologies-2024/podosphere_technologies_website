'use client';

import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { TEMPLATE_NAME_MAX_LENGTH } from '../../../config/settings';
import { useTemplates } from '../../../hooks/use-settings';
import { createTemplate } from '../../../lib/settings.client';
import type { CreateTemplateInput, TemplateItem } from '../../../types/settings';

interface TemplateBarProps {
  /** Templates can only be applied to new posts. */
  canApply: boolean;
  current: Omit<CreateTemplateInput, 'name'>;
  onApply: (template: TemplateItem) => void;
}

export function TemplateBar({ canApply, current, onApply }: TemplateBarProps) {
  const { data: templates, mutate } = useTemplates();
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);

  async function save() {
    setMessage(null);
    setSaving(true);
    try {
      const template = await createTemplate({ ...current, name });
      await mutate();
      setNaming(false);
      setName('');
      setMessage({ error: false, text: `Saved as "${template.name}".` });
    } catch (saveError) {
      setMessage({
        error: true,
        text: saveError instanceof Error ? saveError.message : 'Could not save the template',
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {canApply && templates && templates.length > 0 && (
          <select
            value=""
            aria-label="Use template"
            onChange={(event) => {
              const template = templates.find((entry) => entry.id === event.target.value);
              if (template) {
                onApply(template);
              }
            }}
            className="border-border bg-surface hover:bg-surface-muted h-8 rounded-lg border px-2 text-sm transition outline-none"
          >
            <option value="" disabled>
              Use template…
            </option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
        )}

        {naming ? (
          <form
            className="flex flex-1 items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={TEMPLATE_NAME_MAX_LENGTH}
              placeholder="Template name"
              aria-label="Template name"
              className="h-8 max-w-60"
              autoFocus
            />
            <Button type="submit" size="sm" disabled={saving || !name.trim()}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setNaming(false)} disabled={saving}>
              Cancel
            </Button>
          </form>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setMessage(null);
              setNaming(true);
            }}
          >
            Save as template
          </Button>
        )}
      </div>
      {message && (
        <p className={message.error ? 'text-danger text-sm' : 'text-success text-sm'}>
          {message.text}
        </p>
      )}
    </section>
  );
}
