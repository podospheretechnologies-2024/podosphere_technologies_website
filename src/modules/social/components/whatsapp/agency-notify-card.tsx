'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { apiFetch, fetcher } from '@/shared/lib/fetcher';
import { useClientScopeKey } from '../../hooks/use-client-scope';
import { useWhatsApp } from '../../hooks/use-whatsapp';
import type { WhatsAppAgencyNotify, WhatsAppClientNotify } from '../../types/whatsapp-agency';
import { sendableTemplates, templateKey } from './lead-flow-card';

const ROUTE = '/api/social/whatsapp/agency-notify';
const fieldClass = 'border-border bg-background h-10 w-full rounded-lg border px-3 text-sm';

type Payload = { agency: WhatsAppAgencyNotify; clients: WhatsAppClientNotify[] };

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
  templates: ReturnType<typeof sendableTemplates>;
  name: string | null;
  language: string | null;
  onChange: (name: string | null, language: string | null) => void;
}) {
  const value = templateKey(name, language);
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
        <option value="">Not set</option>
        {templates.map((item) => (
          <option key={item.id} value={templateKey(item.name, item.language)}>
            {item.name} ({item.language})
            {item.headerFormat === 'DOCUMENT' ? ' · PDF header' : ''}
            {item.buttonUrlParamCount > 0 ? ' · link button' : ''}
          </option>
        ))}
      </select>
      {hint && <span className="text-muted-foreground block text-xs">{hint}</span>}
    </label>
  );
}

export function AgencyNotifyCard() {
  const scopeKey = useClientScopeKey();
  const { data: wa } = useWhatsApp();
  const { data, mutate, isLoading } = useSWR<Payload>(
    scopeKey ? `${ROUTE}?${scopeKey}` : null,
    fetcher
  );
  const [agency, setAgency] = useState<WhatsAppAgencyNotify | null>(null);
  const [clients, setClients] = useState<WhatsAppClientNotify[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!data) return;
    setAgency(data.agency);
    setClients(data.clients);
  }, [data]);

  // Document-header templates are allowed here (monthly report PDF).
  const templates = (wa?.templates ?? []).filter(
    (template) =>
      template.status === 'APPROVED' &&
      !template.unsupportedReason &&
      (template.headerFormat === null ||
        template.headerFormat === 'TEXT' ||
        template.headerFormat === 'DOCUMENT')
  );

  async function saveAgency() {
    if (!agency) return;
    setSaving(true);
    setMessage(null);
    try {
      await apiFetch(ROUTE, { method: 'PUT', body: JSON.stringify(agency) });
      await mutate();
      setMessage('Agency templates saved.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  async function saveClient(row: WhatsAppClientNotify) {
    setSaving(true);
    setMessage(null);
    try {
      await apiFetch(ROUTE, {
        method: 'PUT',
        body: JSON.stringify({
          customerId: row.customerId,
          phone: row.phone,
          reportEnabled: row.reportEnabled,
          approvalEnabled: row.approvalEnabled,
          paymentEnabled: row.paymentEnabled,
        }),
      });
      await mutate();
      setMessage(`Saved ${row.customerName}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save client');
    } finally {
      setSaving(false);
    }
  }

  if (isLoading && !data) {
    return (
      <Card className="text-muted-foreground p-6 text-sm">Loading agency WhatsApp…</Card>
    );
  }
  if (!agency) return null;

  return (
    <Card className="space-y-5 p-6">
      <div>
        <h2 className="text-sm font-semibold">Agency WhatsApp (to your clients)</h2>
        <p className="text-muted-foreground mt-1 text-xs">
          Monthly reports, approval reminders and payment reminders from Podosphere&apos;s number.
          Nothing sends until the client switch is on. Reminders only go out 10:00–19:00 IST; approval
          reminders stop after 3 for the same waiting posts.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <TemplateSelect
          label="Monthly report template"
          hint="Use a template with a document header for the PDF."
          templates={templates}
          name={agency.reportTemplate}
          language={agency.reportLanguage}
          onChange={(name, language) =>
            setAgency({ ...agency, reportTemplate: name, reportLanguage: language })
          }
        />
        <TemplateSelect
          label="Approval reminder template"
          hint="Optional URL button → /portal/content."
          templates={templates}
          name={agency.approvalTemplate}
          language={agency.approvalLanguage}
          onChange={(name, language) =>
            setAgency({ ...agency, approvalTemplate: name, approvalLanguage: language })
          }
        />
        <TemplateSelect
          label="Payment reminder template"
          templates={templates}
          name={agency.paymentTemplate}
          language={agency.paymentLanguage}
          onChange={(name, language) =>
            setAgency({ ...agency, paymentTemplate: name, paymentLanguage: language })
          }
        />
      </div>
      <Button type="button" onClick={() => void saveAgency()} disabled={saving}>
        Save templates
      </Button>

      <div className="border-border space-y-3 border-t pt-4">
        <h3 className="text-sm font-medium">Per client</h3>
        {clients.length === 0 ? (
          <p className="text-muted-foreground text-xs">No clients yet.</p>
        ) : (
          <ul className="space-y-3">
            {clients.map((row) => (
              <li
                key={row.customerId}
                className="border-border grid gap-2 rounded-xl border p-3 sm:grid-cols-[1fr_1.2fr_auto] sm:items-end"
              >
                <div>
                  <p className="text-sm font-medium">{row.customerName}</p>
                  <div className="text-muted-foreground mt-2 flex flex-wrap gap-3 text-xs">
                    <label className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={row.reportEnabled}
                        onChange={(event) =>
                          setClients((list) =>
                            list.map((item) =>
                              item.customerId === row.customerId
                                ? { ...item, reportEnabled: event.target.checked }
                                : item
                            )
                          )
                        }
                      />
                      Report
                    </label>
                    <label className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={row.approvalEnabled}
                        onChange={(event) =>
                          setClients((list) =>
                            list.map((item) =>
                              item.customerId === row.customerId
                                ? { ...item, approvalEnabled: event.target.checked }
                                : item
                            )
                          )
                        }
                      />
                      Approvals
                    </label>
                    <label className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={row.paymentEnabled}
                        onChange={(event) =>
                          setClients((list) =>
                            list.map((item) =>
                              item.customerId === row.customerId
                                ? { ...item, paymentEnabled: event.target.checked }
                                : item
                            )
                          )
                        }
                      />
                      Payments
                    </label>
                  </div>
                </div>
                <label className="block space-y-1">
                  <span className="text-xs font-medium">WhatsApp number</span>
                  <input
                    className={fieldClass}
                    placeholder="+91…"
                    value={row.phone ?? ''}
                    onChange={(event) =>
                      setClients((list) =>
                        list.map((item) =>
                          item.customerId === row.customerId
                            ? { ...item, phone: event.target.value || null }
                            : item
                        )
                      )
                    }
                  />
                </label>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={saving}
                  onClick={() => void saveClient(row)}
                >
                  Save
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {message && <p className="text-muted-foreground text-xs">{message}</p>}
    </Card>
  );
}
