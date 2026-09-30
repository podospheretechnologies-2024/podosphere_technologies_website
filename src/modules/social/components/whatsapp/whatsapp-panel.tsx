'use client';

import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { Input } from '@/shared/components/ui/input';
import { SegmentedControl } from '@/shared/components/ui/segmented-control';
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
    return <Card className="text-muted-foreground text-sm">Loading WhatsApp number…</Card>;
  }
  if (error) {
    return <Card className="text-danger text-sm">{error.message}</Card>;
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
    <div className="space-y-6">
      <NumberCard number={data.number} />
      <SendCard data={data} />
      <TemplatesCard data={data} onRefresh={() => void mutate()} />
    </div>
  );
}

function Badge({
  tone,
  children,
}: {
  tone: 'success' | 'warning' | 'danger' | 'muted';
  children: string;
}) {
  return (
    <span
      className={cn(
        'rounded-full px-2 py-0.5 text-xs font-medium',
        tone === 'success' && 'bg-success/15 text-success',
        tone === 'warning' && 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
        tone === 'danger' && 'bg-danger/15 text-danger',
        tone === 'muted' && 'bg-surface-muted text-muted-foreground'
      )}
    >
      {children}
    </span>
  );
}

const qualityTone = { GREEN: 'success', YELLOW: 'warning', RED: 'danger' } as const;

function NumberCard({ number }: { number: WhatsAppNumber }) {
  return (
    <Card className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <p className="text-lg font-semibold tracking-tight">{number.displayPhoneNumber}</p>
        <p className="text-muted-foreground text-sm">{number.verifiedName}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge tone={number.status === 'CONNECTED' ? 'success' : 'warning'}>
          {number.status.toLowerCase()}
        </Badge>
        <Badge tone={qualityTone[number.qualityRating as keyof typeof qualityTone] ?? 'muted'}>
          {`quality: ${number.qualityRating.toLowerCase()}`}
        </Badge>
        {number.messagingLimitTier && (
          <Badge tone="muted">{`limit: ${number.messagingLimitTier.replace('TIER_', '')}/day`}</Badge>
        )}
      </div>
    </Card>
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

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">Send a message</h2>
        <SegmentedControl
          label="Message type"
          options={WHATSAPP_MESSAGE_TYPES}
          value={type}
          onChange={setType}
          disabled={sending}
        />
      </div>

      <form
        className="grid gap-6 md:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <div className="space-y-4">
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
              With country code, no + or leading 0.
            </span>
          </label>

          {type === 'text' ? (
            <label className="block space-y-1.5 text-sm font-medium">
              <span>Message</span>
              <textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                maxLength={WHATSAPP_TEXT_MAX_LENGTH}
                rows={5}
                placeholder="Hi! Thanks for reaching out…"
                className="border-border placeholder:text-muted-foreground block w-full resize-y rounded-lg border bg-transparent p-3 text-sm font-normal outline-none"
              />
              <span className="text-muted-foreground block text-xs font-normal">
                Only delivered if this person messaged your number in the last 24 hours. Otherwise
                use a template.
              </span>
            </label>
          ) : usable.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              {data.templatesAvailable
                ? 'No approved templates yet. Create one in WhatsApp Manager → Message templates.'
                : 'Set WHATSAPP_WABA_ID on the server to load your templates.'}
            </p>
          ) : (
            <>
              <label className="block space-y-1.5 text-sm font-medium">
                <span>Template</span>
                <select
                  className="border-border bg-surface h-10 w-full rounded-lg border px-3 text-sm font-normal"
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

        <div className="flex flex-col gap-4">
          <div className="bg-surface-muted flex-1 rounded-lg p-4">
            <p className="text-muted-foreground mb-2 text-xs">Preview</p>
            <p className="bg-surface max-w-sm rounded-lg p-3 text-sm whitespace-pre-wrap shadow-sm">
              {type === 'text'
                ? text || 'Your message'
                : template
                  ? fillTemplate(template, values)
                  : 'Pick a template'}
            </p>
          </div>

          {result && (
            <div
              role={result.ok ? 'status' : 'alert'}
              className={cn(
                'rounded-lg border p-3 text-sm break-all',
                result.ok
                  ? 'border-success/40 bg-success/10 text-success'
                  : 'border-danger/40 bg-danger/10 text-danger'
              )}
            >
              {result.message}
            </div>
          )}

          <div className="flex justify-end">
            <Button type="submit" disabled={!ready || sending}>
              {sending ? 'Sending…' : 'Send on WhatsApp'}
            </Button>
          </div>
        </div>
      </form>
    </Card>
  );
}

function TemplatesCard({ data, onRefresh }: { data: WhatsAppOverview; onRefresh: () => void }) {
  if (!data.templatesAvailable) {
    return null;
  }
  return (
    <Card className="overflow-x-auto p-0">
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-sm font-semibold">Message templates</h2>
        <Button variant="ghost" size="sm" onClick={onRefresh}>
          Refresh
        </Button>
      </div>
      <table className="w-full text-sm">
        <thead className="border-border text-muted-foreground border-y text-left text-xs">
          <tr>
            <th className="px-4 py-3 font-medium">Template</th>
            <th className="px-4 py-3 font-medium">Category</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Body</th>
          </tr>
        </thead>
        <tbody>
          {data.templates.map((template) => (
            <tr key={template.id} className="border-border border-b last:border-0">
              <td className="px-4 py-3">
                <p className="font-medium">{template.name}</p>
                <p className="text-muted-foreground text-xs">{template.language}</p>
              </td>
              <td className="px-4 py-3 text-xs">{template.category.toLowerCase()}</td>
              <td className="px-4 py-3">
                <Badge
                  tone={
                    template.status === 'APPROVED'
                      ? 'success'
                      : template.status === 'REJECTED'
                        ? 'danger'
                        : 'muted'
                  }
                >
                  {template.status.toLowerCase()}
                </Badge>
                {template.unsupportedReason && (
                  <p className="text-muted-foreground mt-1 text-xs">{template.unsupportedReason}</p>
                )}
              </td>
              <td className="text-muted-foreground max-w-md px-4 py-3 text-xs whitespace-pre-wrap">
                {template.body}
              </td>
            </tr>
          ))}
          {data.templates.length === 0 && (
            <tr>
              <td colSpan={4} className="text-muted-foreground px-4 py-6 text-center">
                No templates yet. Create them in WhatsApp Manager → Message templates.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </Card>
  );
}
