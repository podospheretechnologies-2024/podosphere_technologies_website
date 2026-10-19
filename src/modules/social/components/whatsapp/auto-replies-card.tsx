'use client';

import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Modal } from '@/shared/components/ui/modal';
import { cn } from '@/shared/lib/cn';
import {
  WHATSAPP_AUTO_REPLY_DAYS,
  WHATSAPP_AUTO_REPLY_DEFAULT_TIMEZONE,
  WHATSAPP_AUTO_REPLY_NAME_MAX,
  WHATSAPP_AUTO_REPLY_PATTERN_MAX,
} from '../../config/whatsapp-auto-reply';
import { WHATSAPP_TEXT_MAX_LENGTH } from '../../config/whatsapp';
import { useWhatsAppAutoReplies } from '../../hooks/use-whatsapp-auto-replies';
import {
  deleteWhatsAppAutoReply,
  saveWhatsAppAutoReply,
} from '../../lib/whatsapp-auto-reply.client';
import type {
  SaveWhatsAppAutoReplyInput,
  WhatsAppAutoReplyItem,
} from '../../types/whatsapp-auto-reply';

type DialogState = { open: false } | { open: true; rule: WhatsAppAutoReplyItem | null };

const emptyForm = (): SaveWhatsAppAutoReplyInput => ({
  name: '',
  matchType: 'keyword',
  pattern: '',
  caseSensitive: false,
  replyType: 'text',
  replyText: '',
  templateName: null,
  templateLanguage: 'en',
  templateVariables: [],
  businessHoursEnabled: false,
  businessHoursStart: '09:00',
  businessHoursEnd: '18:00',
  businessHoursTimezone: WHATSAPP_AUTO_REPLY_DEFAULT_TIMEZONE,
  businessHoursDays: [1, 2, 3, 4, 5],
  priority: 100,
  active: true,
});

function summarize(rule: WhatsAppAutoReplyItem): string {
  const match =
    rule.matchType === 'regex' ? `/${rule.pattern}/` : `“${rule.pattern}”`;
  const reply =
    rule.replyType === 'template'
      ? `template ${rule.templateName ?? '?'}`
      : (rule.replyText?.slice(0, 60) ?? 'text');
  const hours = rule.businessHoursEnabled
    ? ` · ${rule.businessHoursStart}–${rule.businessHoursEnd}`
    : '';
  return `${match} → ${reply}${hours}`;
}

export function AutoRepliesCard() {
  const { data, error, mutate } = useWhatsAppAutoReplies();
  const [dialog, setDialog] = useState<DialogState>({ open: false });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function remove(rule: WhatsAppAutoReplyItem) {
    if (!window.confirm(`Delete auto-reply “${rule.name}”?`)) return;
    setActionError(null);
    setBusyId(rule.id);
    try {
      await deleteWhatsAppAutoReply(rule.id);
      await mutate();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not delete');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Keyword auto-replies</h2>
          <p className="text-muted-foreground text-sm">
            Reply automatically when an inbound message matches a keyword or regex. Optional
            business-hours window.
          </p>
        </div>
        <Button size="sm" onClick={() => setDialog({ open: true, rule: null })}>
          Add rule
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
          {error instanceof Error ? error.message : 'Could not load auto-replies'}
        </p>
      ) : !data ? (
        <p className="text-muted-foreground text-sm">Loading auto-replies…</p>
      ) : data.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No rules yet. Add one for “price”, “hours”, or a regex like{' '}
          <code className="text-foreground">^hi\\b</code>.
        </p>
      ) : (
        <ul className="divide-border divide-y rounded-xl border">
          {data.map((rule) => (
            <li
              key={rule.id}
              className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-medium">{rule.name}</p>
                  {!rule.active && (
                    <span className="bg-surface-muted text-muted-foreground rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase">
                      Off
                    </span>
                  )}
                  <span className="text-muted-foreground text-[11px]">#{rule.priority}</span>
                </div>
                <p className="text-muted-foreground truncate text-xs">{summarize(rule)}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setDialog({ open: true, rule })}
                >
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="danger-ghost"
                  disabled={busyId === rule.id}
                  onClick={() => void remove(rule)}
                >
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <AutoReplyDialog
        open={dialog.open}
        rule={dialog.open ? dialog.rule : null}
        onClose={() => setDialog({ open: false })}
        onSaved={async () => {
          setDialog({ open: false });
          await mutate();
        }}
      />
    </Card>
  );
}

function AutoReplyDialog({
  open,
  rule,
  onClose,
  onSaved,
}: {
  open: boolean;
  rule: WhatsAppAutoReplyItem | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  return (
    <Modal
      open={open}
      title={rule ? 'Edit auto-reply' : 'Add auto-reply'}
      description="Matched inbound messages get one reply before they are saved to the inbox."
      size="lg"
      onClose={onClose}
    >
      {open && (
        <AutoReplyForm key={rule?.id ?? 'new'} rule={rule} onCancel={onClose} onSaved={onSaved} />
      )}
    </Modal>
  );
}

function AutoReplyForm({
  rule,
  onCancel,
  onSaved,
}: {
  rule: WhatsAppAutoReplyItem | null;
  onCancel: () => void;
  onSaved: () => Promise<void>;
}) {
  const [form, setForm] = useState<SaveWhatsAppAutoReplyInput>(() =>
    rule
      ? {
          name: rule.name,
          matchType: rule.matchType,
          pattern: rule.pattern,
          caseSensitive: rule.caseSensitive,
          replyType: rule.replyType,
          replyText: rule.replyText,
          templateName: rule.templateName,
          templateLanguage: rule.templateLanguage ?? 'en',
          templateVariables: rule.templateVariables,
          businessHoursEnabled: rule.businessHoursEnabled,
          businessHoursStart: rule.businessHoursStart ?? '09:00',
          businessHoursEnd: rule.businessHoursEnd ?? '18:00',
          businessHoursTimezone:
            rule.businessHoursTimezone ?? WHATSAPP_AUTO_REPLY_DEFAULT_TIMEZONE,
          businessHoursDays: rule.businessHoursDays,
          priority: rule.priority,
          active: rule.active,
        }
      : emptyForm()
  );
  const [variablesRaw, setVariablesRaw] = useState(rule?.templateVariables.join(', ') ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function patch(partial: Partial<SaveWhatsAppAutoReplyInput>) {
    setForm((current) => ({ ...current, ...partial }));
  }

  function toggleDay(day: number) {
    setForm((current) => {
      const days = current.businessHoursDays.includes(day)
        ? current.businessHoursDays.filter((d) => d !== day)
        : [...current.businessHoursDays, day].sort((a, b) => a - b);
      return { ...current, businessHoursDays: days };
    });
  }

  async function submit() {
    setError(null);
    setSaving(true);
    try {
      const variables =
        form.replyType === 'template'
          ? variablesRaw
              .split(',')
              .map((v) => v.trim())
              .filter(Boolean)
          : [];
      await saveWhatsAppAutoReply({ ...form, templateVariables: variables }, rule?.id);
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
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
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Name</span>
        <Input
          value={form.name}
          maxLength={WHATSAPP_AUTO_REPLY_NAME_MAX}
          onChange={(e) => patch({ name: e.target.value })}
          placeholder="Price inquiry"
          required
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Match</span>
          <select
            className="border-border bg-surface h-10 w-full rounded-lg border px-3 text-sm"
            value={form.matchType}
            onChange={(e) =>
              patch({ matchType: e.target.value as SaveWhatsAppAutoReplyInput['matchType'] })
            }
          >
            <option value="keyword">Keyword (contains)</option>
            <option value="regex">Regular expression</option>
          </select>
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Priority</span>
          <Input
            type="number"
            min={0}
            max={10000}
            value={form.priority}
            onChange={(e) => patch({ priority: Number(e.target.value) || 0 })}
          />
        </label>
      </div>

      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Pattern</span>
        <Input
          value={form.pattern}
          maxLength={WHATSAPP_AUTO_REPLY_PATTERN_MAX}
          onChange={(e) => patch({ pattern: e.target.value })}
          placeholder={form.matchType === 'regex' ? '^price\\b' : 'price'}
          required
        />
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.caseSensitive}
          onChange={(e) => patch({ caseSensitive: e.target.checked })}
        />
        Case sensitive
      </label>

      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Reply with</span>
        <select
          className="border-border bg-surface h-10 w-full rounded-lg border px-3 text-sm"
          value={form.replyType}
          onChange={(e) =>
            patch({ replyType: e.target.value as SaveWhatsAppAutoReplyInput['replyType'] })
          }
        >
          <option value="text">Text message</option>
          <option value="template">Approved template</option>
        </select>
      </label>

      {form.replyType === 'text' ? (
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Reply text</span>
          <textarea
            className="border-border bg-surface min-h-24 w-full rounded-lg border px-3 py-2 text-sm"
            maxLength={WHATSAPP_TEXT_MAX_LENGTH}
            value={form.replyText ?? ''}
            onChange={(e) => patch({ replyText: e.target.value })}
            placeholder="Thanks for your message — here are our prices…"
            required
          />
        </label>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Template name</span>
            <Input
              value={form.templateName ?? ''}
              onChange={(e) => patch({ templateName: e.target.value })}
              placeholder="hello_world"
              required
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Language</span>
            <Input
              value={form.templateLanguage ?? 'en'}
              onChange={(e) => patch({ templateLanguage: e.target.value })}
              placeholder="en"
              required
            />
          </label>
          <label className="block space-y-1.5 sm:col-span-2">
            <span className="text-sm font-medium">Variables (comma-separated)</span>
            <Input
              value={variablesRaw}
              onChange={(e) => setVariablesRaw(e.target.value)}
              placeholder="Alice, Podosphere"
            />
          </label>
        </div>
      )}

      <div className="border-border space-y-3 rounded-xl border p-3">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={form.businessHoursEnabled}
            onChange={(e) => patch({ businessHoursEnabled: e.target.checked })}
          />
          Only during business hours
        </label>
        {form.businessHoursEnabled && (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block space-y-1.5">
                <span className="text-muted-foreground text-xs">Start</span>
                <Input
                  type="time"
                  value={form.businessHoursStart ?? '09:00'}
                  onChange={(e) => patch({ businessHoursStart: e.target.value })}
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-muted-foreground text-xs">End</span>
                <Input
                  type="time"
                  value={form.businessHoursEnd ?? '18:00'}
                  onChange={(e) => patch({ businessHoursEnd: e.target.value })}
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-muted-foreground text-xs">Timezone</span>
                <Input
                  value={form.businessHoursTimezone ?? WHATSAPP_AUTO_REPLY_DEFAULT_TIMEZONE}
                  onChange={(e) => patch({ businessHoursTimezone: e.target.value })}
                  placeholder={WHATSAPP_AUTO_REPLY_DEFAULT_TIMEZONE}
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {WHATSAPP_AUTO_REPLY_DAYS.map((day) => {
                const on = form.businessHoursDays.includes(day.value);
                return (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => toggleDay(day.value)}
                    className={cn(
                      'rounded-lg border px-2.5 py-1 text-xs font-medium',
                      on
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground'
                    )}
                  >
                    {day.label}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.active}
          onChange={(e) => patch({ active: e.target.checked })}
        />
        Active
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
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving…' : rule ? 'Save changes' : 'Create rule'}
        </Button>
      </div>
    </form>
  );
}
