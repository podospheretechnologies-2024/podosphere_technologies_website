'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { apiFetch, fetcher } from '@/shared/lib/fetcher';
import { useClientScopeKey } from '../../hooks/use-client-scope';
import { useWhatsApp } from '../../hooks/use-whatsapp';
import type { WhatsAppTemplate } from '../../types/whatsapp';
import type { WhatsAppLeadFlow } from '../../types/whatsapp-lead-flow';

const LEAD_FLOW_ROUTE = '/api/social/whatsapp/lead-flow';
const fieldClass = 'border-border bg-background h-10 w-full rounded-lg border px-3 text-sm';

/** Templates that can be sent without extra input (approved, no media header or button values). */
export function sendableTemplates(templates: WhatsAppTemplate[] | undefined): WhatsAppTemplate[] {
  return (templates ?? []).filter(
    (template) =>
      template.status === 'APPROVED' &&
      !template.unsupportedReason &&
      template.headerFormat !== 'DOCUMENT' &&
      template.buttonUrlParamCount === 0
  );
}

export const templateKey = (name: string | null, language: string | null) =>
  name && language ? `${name}|${language}` : '';

function TemplateSelect({
  label,
  hint,
  templates,
  name,
  language,
  onChange,
}: {
  label: string;
  hint?: string;
  templates: WhatsAppTemplate[];
  name: string | null;
  language: string | null;
  onChange: (name: string | null, language: string | null) => void;
}) {
  const value = templateKey(name, language);
  const missing = value && !templates.some((item) => templateKey(item.name, item.language) === value);
  const selected = templates.find((item) => templateKey(item.name, item.language) === value);
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium">{label}</span>
      <select
        className={fieldClass}
        value={value}
        onChange={(event) => {
          const [nextName, nextLanguage] = event.target.value.split('|');
          onChange(nextName || null, nextLanguage || null);
        }}
      >
        <option value="">Do not send</option>
        {missing && <option value={value}>{name} (not approved any more)</option>}
        {templates.map((item) => (
          <option key={item.id} value={templateKey(item.name, item.language)}>
            {item.name} ({item.language}, {item.category.toLowerCase()})
          </option>
        ))}
      </select>
      {selected ? (
        <span className="text-muted-foreground block text-xs whitespace-pre-line">{selected.body}</span>
      ) : (
        hint && <span className="text-muted-foreground block text-xs">{hint}</span>
      )}
    </label>
  );
}

function HoursInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (hours: number) => void;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium">Send after (hours)</span>
      <input
        type="number"
        min={1}
        max={720}
        className={fieldClass}
        value={value}
        onChange={(event) => onChange(Math.max(1, Math.round(Number(event.target.value) || 1)))}
      />
    </label>
  );
}

export function LeadFlowCard() {
  const scopeKey = useClientScopeKey();
  const whatsapp = useWhatsApp();
  const { data, error, mutate } = useSWR<WhatsAppLeadFlow>(
    whatsapp.data?.configured ? [LEAD_FLOW_ROUTE, scopeKey] : null,
    ([url]: [string, string]) => fetcher<WhatsAppLeadFlow>(url),
    { revalidateOnFocus: false }
  );
  const [form, setForm] = useState<WhatsAppLeadFlow | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    setForm(data ?? null);
    setMessage(null);
  }, [data]);

  if (!whatsapp.data?.configured) {
    return null;
  }

  const templates = sendableTemplates(whatsapp.data.templates);
  const set = (patch: Partial<WhatsAppLeadFlow>) => {
    setForm((current) => (current ? { ...current, ...patch } : current));
    setMessage(null);
  };

  async function save() {
    if (!form) return;
    setSaving(true);
    setMessage(null);
    try {
      const saved = await apiFetch<WhatsAppLeadFlow>(LEAD_FLOW_ROUTE, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      await mutate(saved, { revalidate: false });
      setMessage({
        ok: true,
        text: saved.enabled
          ? 'Saved. New leads will get the welcome message.'
          : 'Saved. Automatic messages to leads are off.',
      });
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : 'Could not save' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Messages to new leads</h2>
        <p className="text-muted-foreground text-sm">
          When someone fills in a lead form on your Facebook or Instagram ad, send them a WhatsApp
          template straight away, follow up if they stay silent, and tell your sales person.
        </p>
      </div>

      {error && !data ? (
        <p className="text-danger text-sm">
          {error instanceof Error ? error.message : 'Could not load these settings'}
        </p>
      ) : !form ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : (
        <>
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={form.enabled}
              onChange={(event) => set({ enabled: event.target.checked })}
            />
            <span className="text-sm font-medium">Send WhatsApp messages to new leads automatically</span>
          </label>

          <TemplateSelect
            label="1. Welcome message (sent at once)"
            hint="Choose an approved template."
            templates={templates}
            name={form.welcomeTemplate}
            language={form.welcomeLanguage}
            onChange={(name, language) => set({ welcomeTemplate: name, welcomeLanguage: language })}
          />

          <div className="grid gap-3 md:grid-cols-[1fr_10rem]">
            <TemplateSelect
              label="2. First follow-up (only if they have not replied)"
              templates={templates}
              name={form.followUp1Template}
              language={form.followUp1Language}
              onChange={(name, language) =>
                set({ followUp1Template: name, followUp1Language: language })
              }
            />
            <HoursInput
              value={form.followUp1AfterHours}
              onChange={(hours) => set({ followUp1AfterHours: hours })}
            />
          </div>

          <div className="grid gap-3 md:grid-cols-[1fr_10rem]">
            <TemplateSelect
              label="3. Second follow-up (only if they still have not replied)"
              templates={templates}
              name={form.followUp2Template}
              language={form.followUp2Language}
              onChange={(name, language) =>
                set({ followUp2Template: name, followUp2Language: language })
              }
            />
            <HoursInput
              value={form.followUp2AfterHours}
              onChange={(hours) => set({ followUp2AfterHours: hours })}
            />
          </div>

          <div className="border-border space-y-3 border-t pt-4">
            <p className="text-sm font-medium">Alert your sales person</p>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="block space-y-1">
                <span className="text-sm font-medium">Sales person&apos;s WhatsApp number</span>
                <input
                  type="tel"
                  className={fieldClass}
                  placeholder="+91 98765 43210"
                  value={form.alertPhone ?? ''}
                  onChange={(event) => set({ alertPhone: event.target.value || null })}
                />
              </label>
              <TemplateSelect
                label="Alert template"
                hint="Works even when automatic messages to leads are off."
                templates={templates}
                name={form.alertTemplate}
                language={form.alertLanguage}
                onChange={(name, language) => set({ alertTemplate: name, alertLanguage: language })}
              />
            </div>
          </div>

          <p className="text-muted-foreground text-xs">
            Blanks in a template are filled from the lead: {'{{1}}'} name, {'{{2}}'} phone, {'{{3}}'}{' '}
            email, {'{{4}}'} the ad or form it came from. Follow-up hours count from the message
            before. Follow-ups stop when the lead replies or says STOP. Meta charges for each
            template sent, and your lead form must say people agree to be contacted on WhatsApp.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
            {message && (
              <p className={message.ok ? 'text-sm' : 'text-danger text-sm'} role="status">
                {message.text}
              </p>
            )}
          </div>
        </>
      )}
    </Card>
  );
}
