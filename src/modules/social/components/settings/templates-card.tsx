'use client';

import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { useTemplates } from '../../hooks/use-settings';
import { deleteTemplate } from '../../lib/settings.client';
import type { TemplateItem } from '../../types/settings';
import { TemplateRenameDialog } from './template-rename-dialog';

function summary(template: TemplateItem): string {
  const { integrationIds, values } = template.content;
  const comments = values.length - 1;
  return [
    `${integrationIds.length} channel${integrationIds.length === 1 ? '' : 's'}`,
    comments > 0 && `${comments} comment${comments === 1 ? '' : 's'}`,
  ]
    .filter(Boolean)
    .join(' · ');
}

export function TemplatesCard() {
  const { data, error, mutate } = useTemplates();
  const [renaming, setRenaming] = useState<TemplateItem | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function remove(template: TemplateItem) {
    if (!window.confirm(`Delete the template "${template.name}"?`)) {
      return;
    }
    setActionError(null);
    setBusyId(template.id);
    try {
      await deleteTemplate(template.id);
      await mutate();
    } catch (deleteError) {
      setActionError(deleteError instanceof Error ? deleteError.message : 'Could not delete');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Post templates</h2>
        <p className="text-muted-foreground text-sm">
          Save a post as a template from the composer to reuse its channels, tags and content.
        </p>
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
          {error instanceof Error ? error.message : 'Could not load templates'}
        </p>
      ) : !data ? (
        <p className="text-muted-foreground text-sm">Loading templates…</p>
      ) : data.length === 0 ? (
        <p className="text-muted-foreground text-sm">No templates yet.</p>
      ) : (
        <ul className="space-y-2">
          {data.map((template) => (
            <li
              key={template.id}
              className="border-border flex items-start gap-3 rounded-lg border p-3"
            >
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-sm font-medium">{template.name}</p>
                <p className="text-muted-foreground line-clamp-2 text-sm break-words whitespace-pre-line">
                  {template.content.values[0]?.content || 'Media only'}
                </p>
                <p className="text-muted-foreground text-xs">{summary(template)}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busyId === template.id}
                  onClick={() => setRenaming(template)}
                >
                  Rename
                </Button>
                <Button
                  variant="danger-ghost"
                  size="sm"
                  disabled={busyId === template.id}
                  onClick={() => remove(template)}
                >
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <TemplateRenameDialog
        template={renaming}
        onClose={() => setRenaming(null)}
        onSaved={() => {
          setRenaming(null);
          void mutate();
        }}
      />
    </Card>
  );
}
