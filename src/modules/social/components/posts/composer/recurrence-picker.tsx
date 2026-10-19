'use client';

import { Input } from '@/shared/components/ui/input';
import { cn } from '@/shared/lib/cn';
import { RECURRENCE_RULE_LABELS, RECURRENCE_RULES, type RecurrenceRule } from '../../../config/posts';
import type { PostRecurrence } from '../../../types/post';

export type RecurrenceDraft = {
  rule: RecurrenceRule;
  until: string;
  maxRuns: string;
  evergreen: boolean;
} | null;

export function toRecurrenceDraft(recurrence: PostRecurrence | null | undefined): RecurrenceDraft {
  if (!recurrence) return null;
  return {
    rule: recurrence.rule,
    until: recurrence.until ? recurrence.until.slice(0, 10) : '',
    maxRuns: recurrence.maxRuns != null ? String(recurrence.maxRuns) : '',
    evergreen: recurrence.evergreen,
  };
}

export function recurrenceDraftToPayload(draft: RecurrenceDraft): {
  rule: RecurrenceRule;
  until: string | null;
  maxRuns: number | null;
  evergreen: boolean;
} | null {
  if (!draft) return null;
  const maxRuns = draft.maxRuns.trim() ? Number.parseInt(draft.maxRuns, 10) : null;
  return {
    rule: draft.rule,
    until: draft.until ? new Date(`${draft.until}T23:59:59`).toISOString() : null,
    maxRuns: maxRuns != null && Number.isFinite(maxRuns) && maxRuns > 0 ? maxRuns : null,
    evergreen: draft.evergreen,
  };
}

interface RecurrencePickerProps {
  value: RecurrenceDraft;
  onChange: (value: RecurrenceDraft) => void;
}

export function RecurrencePicker({ value, onChange }: RecurrencePickerProps) {
  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => onChange(null)}
          className={cn(
            'rounded-lg border px-2.5 py-1.5 text-xs font-medium transition',
            value === null
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border text-muted-foreground hover:text-foreground'
          )}
        >
          Does not repeat
        </button>
        {RECURRENCE_RULES.map((rule) => (
          <button
            key={rule}
            type="button"
            onClick={() =>
              onChange({
                rule,
                until: value?.until ?? '',
                maxRuns: value?.maxRuns ?? '',
                evergreen: value?.evergreen ?? false,
              })
            }
            className={cn(
              'rounded-lg border px-2.5 py-1.5 text-xs font-medium transition',
              value?.rule === rule
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:text-foreground'
            )}
          >
            {RECURRENCE_RULE_LABELS[rule]}
          </button>
        ))}
      </div>

      {value && (
        <div className="space-y-2 border-t border-border pt-3">
          <label className="block space-y-1">
            <span className="text-muted-foreground text-xs">Until (optional)</span>
            <Input
              type="date"
              value={value.until}
              onChange={(event) => onChange({ ...value, until: event.target.value })}
              className="h-9"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-muted-foreground text-xs">Max runs (optional)</span>
            <Input
              type="number"
              min={1}
              max={365}
              placeholder="Unlimited"
              value={value.maxRuns}
              onChange={(event) => onChange({ ...value, maxRuns: event.target.value })}
              className="h-9"
            />
          </label>
          <label className="flex items-start gap-2 text-xs">
            <input
              type="checkbox"
              checked={value.evergreen}
              onChange={(event) => onChange({ ...value, evergreen: event.target.checked })}
              className="mt-0.5"
            />
            <span>
              <span className="text-foreground font-medium">Evergreen slot</span>
              <span className="text-muted-foreground block">
                Prefer an empty calendar slot at least 7 days later instead of a fixed interval.
              </span>
            </span>
          </label>
        </div>
      )}
    </div>
  );
}
