'use client';

import { MessageCircle, Phone, RefreshCw, Send, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { Input } from '@/shared/components/ui/input';
import { cn } from '@/shared/lib/cn';
import {
  WHATSAPP_MESSAGE_TYPES,
  WHATSAPP_PHONE_PATTERN,
  WHATSAPP_TEXT_MAX_LENGTH,
  type WhatsAppMessageType,
} from '../../config/whatsapp';
import { useWhatsApp } from '../../hooks/use-whatsapp';
import { sendWhatsAppMessage } from '../../lib/whatsapp.client';
import type { WhatsAppNumber, WhatsAppOverview, WhatsAppTemplate } from '../../types/whatsapp';
import { WhatsAppInbox } from './whatsapp-inbox';

const templateKey = (template: WhatsAppTemplate) => `${template.name}:${template.language}`;

function sendable(template: WhatsAppTemplate) {
  return template.status === 'APPROVED' && !template.unsupportedReason;
}

/** Body text with the typed values (or the placeholder names) filled in. */
function fillTemplate(template: WhatsAppTemplate, values: string[]) {
  return template.variables.reduce(
    (text, name, index) =>
      text.replaceAll(
        new RegExp(`\\{\\{\\s*${name}\\s*\\}\\}`, 'g'),
        values[index]?.trim() || `{{${name}}}`
      ),
    template.body
  );
}

export function WhatsAppPanel() {
  const { data, error, isLoading, mutate } = useWhatsApp();

  if (isLoading) {
    return (
      <div className="border-border bg-surface text-muted-foreground rounded-2xl border p-8 text-sm">
        Loading WhatsApp number…
      </div>
    );
  }
  if (error) {
    return (
      <div className="border-danger/40 bg-danger/10 text-danger rounded-2xl border p-6 text-sm">
        {error.message}
      </div>
    );
  }
  if (!data?.configured || !data.number) {
    return (
      <EmptyState
        title="WhatsApp is not connected yet"
        description="Generate a system user token with whatsapp_business_messaging and whatsapp_business_management, then set WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_WABA_ID on the server."
      />
    );
  }

  return (
    <div className="space-y-5">
      <NumberStrip number={data.number} />
      <WhatsAppInbox number={data.number} />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <SendCard data={data} />
        <TemplatesCard data={data} onRefresh={() => void mutate()} />
      </div>
    </div>
  );
}

function StatusChip({
  tone,
  children,
}: {
  tone: 'success' | 'warning' | 'danger' | 'muted';
  children: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide uppercase',
        tone === 'success' && 'bg-success/15 text-success',
        tone === 'warning' && 'bg-amber-500/15 text-amber-600',
        tone === 'danger' && 'bg-danger/15 text-danger',
        tone === 'muted' && 'bg-surface-muted text-muted-foreground'
      )}
    >
      <span
        className={cn(
          'size-1.5 rounded-full',
          tone === 'success' && 'bg-success',
          tone === 'warning' && 'bg-amber-500',
          tone === 'danger' && 'bg-danger',
          tone === 'muted' && 'bg-muted-foreground'
        )}
      />
      {children}
    </span>
  );
}

const qualityTone = { GREEN: 'success', YELLOW: 'warning', RED: 'danger' } as const;

function NumberStrip({ number }: { number: WhatsAppNumber }) {
  return (
    <div className="border-border from-surface via-surface to-success/5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-gradient-to-r px-4 py-3.5">
      <div className="flex min-w-0 items-center gap-3">
        <span className="bg-success/15 text-success flex size-11 shrink-0 items-center justify-center rounded-2xl">
          <Phone className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-base font-semibold tracking-tight">
            {number.displayPhoneNumber}
          </p>
          <p className="text-muted-foreground truncate text-sm">{number.verifiedName}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <StatusChip tone={number.status === 'CONNECTED' ? 'success' : 'warning'}>
          {number.status.toLowerCase()}
        </StatusChip>
        <StatusChip tone={qualityTone[number.qualityRating as keyof typeof qualityTone] ?? 'muted'}>
          {`quality ${number.qualityRating.toLowerCase()}`}
        </StatusChip>
        {number.messagingLimitTier && (
          <StatusChip tone="muted">
            {`${number.messagingLimitTier.replace('TIER_', '')}/day`}
          </StatusChip>
        )}
      </div>
    </div>
  );
}

function SendCard({ data }: { data: WhatsAppOverview }) {
  const usable = data.templates.filter(sendable);
  const [type, setType] = useState<WhatsAppMessageType>(usable.length ? 'template' : 'text');
  const [to, setTo] = useState('');
  const [text, setText] = useState('');
  const [selectedKey, setSelectedKey] = useState(usable[0] ? templateKey(usable[0]) : '');
  const [values, setValues] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const template = usable.find((item) => templateKey(item) === selectedKey) ?? null;
  const recipient = to.replace(/[\s()+-]/g, '');
  const validRecipient = WHATSAPP_PHONE_PATTERN.test(recipient);
  const ready =
    validRecipient &&
    (type === 'text'
      ? text.trim().length > 0
      : template !== null && template.variables.every((_, index) => values[index]?.trim()));

  function pickTemplate(key: string) {
    setSelectedKey(key);
    setValues([]);
  }

  async function send() {
    setSending(true);
    setResult(null);
    try {
      const sent = await sendWhatsAppMessage(
        type === 'text'
          ? { type, to: recipient, text }
          : {
              type,
              to: recipient,
              templateName: template!.name,
              language: template!.language,
              variables: template!.variables.map((_, index) => values[index].trim()),
            }
      );
      setResult({
        ok: true,
        message: `Sent to +${sent.waId ?? recipient}. Message id: ${sent.messageId}`,
      });
      if (type === 'text') {
        setText('');
      }
    } catch (sendError) {
      setResult({
        ok: false,
        message: sendError instanceof Error ? sendError.message : 'Could not send',
      });
    } finally {
      setSending(false);
    }
  }

  const previewText =
    type === 'text'
      ? text || 'Your message will appear here'
      : template
        ? fillTemplate(template, values)
        : 'Pick a template to preview';

  return (
    <section className="border-border bg-surface overflow-hidden rounded-2xl border">
      <div className="border-border flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="bg-primary/15 text-primary flex size-8 items-center justify-center rounded-xl">
            <Send className="size-3.5" />
          </span>
          <div>
            <h2 className="text-sm font-semibold">Compose</h2>
            <p className="text-muted-foreground text-xs">Send text or an approved template</p>
          </div>
        </div>
        <div
          role="tablist"
          aria-label="Message type"
          className="bg-surface-muted flex rounded-lg p-0.5"
        >
          {WHATSAPP_MESSAGE_TYPES.map((option) => (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={type === option.value}
              disabled={sending}
              onClick={() => setType(option.value)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-semibold transition',
                type === option.value
                  ? 'bg-surface text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <form
        className="grid gap-0 md:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <div className="border-border space-y-4 border-b p-4 md:border-r md:border-b-0">
          <label className="block space-y-1.5 text-sm font-medium">
            <span>To</span>
            <Input
              value={to}
              onChange={(event) => setTo(event.target.value)}
              inputMode="tel"
              placeholder="919876543210"
              aria-invalid={to.length > 0 && !validRecipient}
            />
            <span className="text-muted-foreground block text-xs font-normal">
              Country code, no + or leading 0
            </span>
          </label>

          {type === 'text' ? (
            <label className="block space-y-1.5 text-sm font-medium">
              <span>Message</span>
              <textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                maxLength={WHATSAPP_TEXT_MAX_LENGTH}
                rows={6}
                placeholder="Hi! Thanks for reaching out…"
                className="border-border placeholder:text-muted-foreground bg-surface-muted/40 block w-full resize-y rounded-xl border p-3 text-sm font-normal outline-none"
              />
              <span className="text-muted-foreground block text-xs font-normal">
                Free-form only works inside the 24-hour customer window.
              </span>
            </label>
          ) : usable.length === 0 ? (
            <p className="text-muted-foreground rounded-xl border border-dashed p-4 text-sm">
              {data.templatesAvailable
                ? 'No approved templates yet. Create one in WhatsApp Manager → Message templates.'
                : 'Set WHATSAPP_WABA_ID on the server to load your templates.'}
            </p>
          ) : (
            <>
              <label className="block space-y-1.5 text-sm font-medium">
                <span>Template</span>
                <select
                  className="border-border bg-surface-muted/40 h-10 w-full rounded-xl border px-3 text-sm font-normal outline-none"
                  value={selectedKey}
                  onChange={(event) => pickTemplate(event.target.value)}
                >
                  {usable.map((item) => (
                    <option key={templateKey(item)} value={templateKey(item)}>
                      {item.name} ({item.language}) · {item.category.toLowerCase()}
                    </option>
                  ))}
                </select>
              </label>
              {template?.variables.map((name, index) => (
                <label key={name} className="block space-y-1.5 text-sm font-medium">
                  <span>{`{{${name}}}`}</span>
                  <Input
                    value={values[index] ?? ''}
                    onChange={(event) =>
                      setValues((current) => {
                        const next = [...current];
                        next[index] = event.target.value;
                        return next;
                      })
                    }
                  />
                </label>
              ))}
            </>
          )}
        </div>

        <div className="flex flex-col gap-4 p-4">
          <div className="bg-surface-muted/50 flex min-h-[220px] flex-1 flex-col rounded-2xl p-4">
            <p className="text-muted-foreground mb-3 text-[11px] font-semibold tracking-wide uppercase">
              Preview
            </p>
            <div className="flex flex-1 items-end justify-end">
              <div className="bg-success max-w-[90%] rounded-2xl rounded-br-md px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap text-white shadow-sm">
                {previewText}
              </div>
            </div>
          </div>

          {result && (
            <div
              role={result.ok ? 'status' : 'alert'}
              className={cn(
                'rounded-xl border p-3 text-sm break-all',
                result.ok
                  ? 'border-success/40 bg-success/10 text-success'
                  : 'border-danger/40 bg-danger/10 text-danger'
              )}
            >
              {result.message}
            </div>
          )}

          <Button type="submit" disabled={!ready || sending} className="w-full sm:w-auto sm:self-end">
            <Send className="size-4" />
            {sending ? 'Sending…' : 'Send on WhatsApp'}
          </Button>
        </div>
      </form>
    </section>
  );
}

function TemplatesCard({ data, onRefresh }: { data: WhatsAppOverview; onRefresh: () => void }) {
  if (!data.templatesAvailable) {
    return null;
  }

  return (
    <section className="border-border bg-surface flex flex-col overflow-hidden rounded-2xl border">
      <div className="border-border flex items-center justify-between gap-3 border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="bg-surface-muted text-muted-foreground flex size-8 items-center justify-center rounded-xl">
            <MessageCircle className="size-3.5" />
          </span>
          <div>
            <h2 className="text-sm font-semibold">Templates</h2>
            <p className="text-muted-foreground text-xs">
              {data.templates.length} from your WhatsApp Business account
            </p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onRefresh}>
          <RefreshCw className="size-3.5" />
          Refresh
        </Button>
      </div>

      <div className="max-h-[420px] space-y-2 overflow-y-auto p-3">
        {data.templates.length === 0 ? (
          <p className="text-muted-foreground px-2 py-8 text-center text-sm">
            No templates yet. Create them in WhatsApp Manager → Message templates.
          </p>
        ) : (
          data.templates.map((template) => (
            <article
              key={template.id}
              className="border-border bg-surface-muted/30 rounded-xl border p-3"
            >
              <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{template.name}</p>
                  <p className="text-muted-foreground text-xs">
                    {template.language} · {template.category.toLowerCase()}
                  </p>
                </div>
                <StatusChip
                  tone={
                    template.status === 'APPROVED'
                      ? 'success'
                      : template.status === 'REJECTED'
                        ? 'danger'
                        : 'muted'
                  }
                >
                  {template.status.toLowerCase()}
                </StatusChip>
              </div>
              <p className="text-muted-foreground line-clamp-4 text-xs leading-relaxed whitespace-pre-wrap">
                {template.body}
              </p>
              {template.unsupportedReason && (
                <p className="text-danger mt-2 text-xs">{template.unsupportedReason}</p>
              )}
              <div className="mt-3 flex justify-end">
                <Button 
                  variant="danger-ghost" 
                  size="sm" 
                  onClick={async () => {
                    if (!window.confirm(`Delete template "${template.name}" from Meta?`)) return;
                    await fetch(`/api/social/whatsapp/templates?name=${template.name}`, { method: 'DELETE' });
                    onRefresh();
                  }}
                >
                  <Trash2 className="size-3.5" /> Delete
                </Button>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
