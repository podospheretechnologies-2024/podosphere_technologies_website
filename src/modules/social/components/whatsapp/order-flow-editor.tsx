'use client';

import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { Button } from '@/shared/components/ui/button';
import { fetcher } from '@/shared/lib/fetcher';
import {
  ORDER_FLOW_BY_KEY,
  ORDER_FLOW_STARTER_TEMPLATES,
  ORDER_FLOW_VARIABLE_FIELDS,
  type OrderFlowDelayUnit,
  type OrderFlowKey,
  type OrderFlowVariableField,
} from '../../config/order-flows';
import { useClientScopeKey } from '../../hooks/use-client-scope';
import { useWhatsApp } from '../../hooks/use-whatsapp';
import { ORDER_FLOWS_API, patchOrderFlow, testOrderFlow } from '../../lib/order-flow.client';
import type {
  OrderFlowDetail,
  OrderFlowOnlyIf,
  OrderFlowStopIf,
  OrderFlowVariableMap,
} from '../../types/order-flow';
import type { WhatsAppTemplate } from '../../types/whatsapp';
import { templateKey } from './lead-flow-card';

const fieldClass = 'border-border bg-background h-10 w-full rounded-lg border px-3 text-sm';

const SAMPLE_VALUES: Record<OrderFlowVariableField, string> = {
  customer_first_name: 'Priya',
  customer_full_name: 'Priya Sharma',
  order_number: '#1042',
  order_total: '₹1,499',
  number_of_items: '2',
  first_product_name: 'Glow Serum',
  payment_type: 'Prepaid',
  tracking_link: 'https://track.example/abc',
  courier_name: 'Delhivery',
  checkout_link: 'https://shop.example/checkouts/abc',
  order_status_link: 'https://shop.example/orders/1042',
  discount_code: 'COMEBACK10',
  store_name: 'Your store',
};

/** Approved templates including URL buttons (order flows need checkout/track links). */
export function orderFlowSendableTemplates(
  templates: WhatsAppTemplate[] | undefined
): WhatsAppTemplate[] {
  return (templates ?? []).filter(
    (template) =>
      template.status === 'APPROVED' &&
      !template.unsupportedReason &&
      template.headerFormat !== 'DOCUMENT' &&
      template.headerFormat !== 'IMAGE' &&
      template.headerFormat !== 'VIDEO'
  );
}

function fillBody(
  body: string,
  variableMap: OrderFlowVariableMap,
  storeName?: string | null
): string {
  return body.replace(/\{\{(\d+)\}\}/g, (_match, index: string) => {
    const field = variableMap[index];
    if (!field || typeof field !== 'string') return `{{${index}}}`;
    if (field === 'store_name' && storeName) return storeName;
    return SAMPLE_VALUES[field as OrderFlowVariableField] ?? `{{${index}}}`;
  });
}

function defaultVariableMap(template: WhatsAppTemplate | undefined): OrderFlowVariableMap {
  if (!template) return {};
  const map: OrderFlowVariableMap = {};
  template.variables.forEach((_, index) => {
    map[String(index + 1)] = '';
  });
  if (template.buttonUrlParamCount > 0) {
    map.button_url = '';
  }
  return map;
}

function PhonePreview({
  businessName,
  body,
  buttonText,
}: {
  businessName: string;
  body: string;
  buttonText?: string;
}) {
  return (
    <div className="border-border bg-surface-muted/30 mx-auto w-full max-w-[280px] rounded-2xl border p-3">
      <div className="mb-3 flex items-center justify-between px-1">
        <p className="text-sm font-semibold">{businessName}</p>
        <span className="text-muted-foreground text-xs" aria-hidden>
          ✓
        </span>
      </div>
      <div className="rounded-xl bg-[#dcf8c6] px-3 py-2 text-sm text-[#111] shadow-sm">
        <p className="whitespace-pre-wrap">{body || 'Choose a template to preview.'}</p>
        {buttonText ? (
          <p className="mt-2 border-t border-black/10 pt-2 text-center text-sm font-medium text-[#056162]">
            {buttonText}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function OrderFlowEditor({
  flowKey,
  storeName,
  onCancel,
  onSaved,
}: {
  flowKey: OrderFlowKey;
  storeName?: string | null;
  onCancel: () => void;
  onSaved: () => Promise<unknown> | void;
}) {
  const definition = ORDER_FLOW_BY_KEY[flowKey];
  const starter = ORDER_FLOW_STARTER_TEMPLATES[flowKey];
  const scopeKey = useClientScopeKey();
  const whatsapp = useWhatsApp();
  const templates = orderFlowSendableTemplates(whatsapp.data?.templates);

  const { data: detail, error: loadError } = useSWR<OrderFlowDetail>(
    scopeKey ? [`${ORDER_FLOWS_API}/${flowKey}`, scopeKey] : null,
    ([url]: [string, string]) => fetcher(url),
    { revalidateOnFocus: false }
  );

  const [delayValue, setDelayValue] = useState<number>(definition.defaultDelay?.value ?? 0);
  const [delayUnit, setDelayUnit] = useState<OrderFlowDelayUnit>(
    definition.defaultDelay?.unit ?? 'minutes'
  );
  const [onlyIf, setOnlyIf] = useState<OrderFlowOnlyIf>({
    minCartValue: null,
    paymentType: 'any',
  });
  const [templateName, setTemplateName] = useState<string | null>(null);
  const [templateLanguage, setTemplateLanguage] = useState<string | null>(null);
  const [variableMap, setVariableMap] = useState<OrderFlowVariableMap>({});
  const [stopIf, setStopIf] = useState<OrderFlowStopIf>({
    onOrderPlaced: true,
    onStopReply: true,
  });
  const [hydrated, setHydrated] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!detail || hydrated) return;
    setDelayValue(detail.delayValue ?? definition.defaultDelay?.value ?? 0);
    setDelayUnit(detail.delayUnit ?? definition.defaultDelay?.unit ?? 'minutes');
    setOnlyIf({
      minCartValue: detail.onlyIf.minCartValue ?? null,
      paymentType: detail.onlyIf.paymentType ?? 'any',
    });
    setTemplateName(detail.templateName);
    setTemplateLanguage(detail.templateLanguage);
    setVariableMap(detail.variableMap ?? {});
    setStopIf({
      onOrderPlaced: detail.stopIf.onOrderPlaced !== false,
      onStopReply: detail.stopIf.onStopReply !== false,
    });
    setHydrated(true);
  }, [detail, hydrated, definition.defaultDelay]);

  const selected = useMemo(
    () =>
      templates.find(
        (item) =>
          templateKey(item.name, item.language) === templateKey(templateName, templateLanguage)
      ),
    [templates, templateName, templateLanguage]
  );

  useEffect(() => {
    if (!selected || !hydrated) return;
    setVariableMap((current) => {
      const next = { ...defaultVariableMap(selected), ...current };
      for (const key of Object.keys(next)) {
        if (key === 'button_url') continue;
        if (!/^\d+$/.test(key)) continue;
        if (!selected.variables.some((_, i) => String(i + 1) === key)) {
          delete next[key];
        }
      }
      if (selected.buttonUrlParamCount === 0) delete next.button_url;
      return next;
    });
  }, [selected?.id, hydrated]);

  const previewBody = selected
    ? fillBody(selected.body, variableMap, storeName)
    : fillBody(starter.body, variableMap, storeName);
  const previewButton =
    selected && selected.buttonUrlParamCount > 0
      ? starter.buttonText ?? 'Open link'
      : starter.buttonText && !selected
        ? starter.buttonText
        : undefined;

  const showWait = definition.defaultDelay != null || (detail?.delayValue != null);
  const showOnlyIf = definition.group === 'recover_sales' || definition.key.includes('cod');

  function setVariable(slot: string, field: OrderFlowVariableField | '') {
    setVariableMap((current) => ({
      ...current,
      [slot]: field || '',
    }));
    setMessage(null);
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      await patchOrderFlow(flowKey, {
        templateName,
        templateLanguage,
        delayValue: showWait ? delayValue : null,
        delayUnit: showWait ? delayUnit : null,
        onlyIf: showOnlyIf
          ? {
              minCartValue: onlyIf.minCartValue || null,
              paymentType: onlyIf.paymentType ?? 'any',
            }
          : { minCartValue: null, paymentType: 'any' },
        variableMap,
        stopIf,
      });
      await onSaved();
      setMessage({ ok: true, text: 'Saved.' });
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : 'Could not save' });
    } finally {
      setSaving(false);
    }
  }

  async function sendTest() {
    if (!testPhone.trim()) {
      setMessage({ ok: false, text: 'Enter a phone number with country code.' });
      return;
    }
    setTesting(true);
    setMessage(null);
    try {
      // Persist current template mapping first so the test uses latest blanks.
      await patchOrderFlow(flowKey, {
        templateName,
        templateLanguage,
        variableMap,
      });
      const result = await testOrderFlow(flowKey, testPhone.trim());
      setMessage({
        ok: true,
        text: `Test sent to ${result.to} (id ${result.messageId}).`,
      });
    } catch (err) {
      setMessage({
        ok: false,
        text: err instanceof Error ? err.message : 'Could not send test',
      });
    } finally {
      setTesting(false);
    }
  }

  const blankSlots = selected
    ? selected.variables.map((_, i) => String(i + 1))
    : Object.keys(variableMap).filter((k) => k !== 'button_url');

  if (loadError && !detail) {
    return (
      <p className="text-danger text-sm">
        {loadError instanceof Error ? loadError.message : 'Could not load this flow'}
      </p>
    );
  }

  if (!hydrated && !detail) {
    return <p className="text-muted-foreground text-sm">Loading flow…</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">{definition.label}</h2>
          <p className="text-muted-foreground text-sm">{definition.when}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => void save()} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
          <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
        </div>
      </div>

      {message && (
        <p className={message.ok ? 'text-sm text-emerald-700' : 'text-danger text-sm'} role="status">
          {message.text}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-5">
          <section className="space-y-1">
            <p className="text-sm font-medium">1. When</p>
            <p className="text-muted-foreground text-sm">{definition.when}</p>
            {definition.marketingHours && (
              <p className="text-muted-foreground text-xs">
                Marketing hours: sent only between 10:00 and 21:00 India time.
              </p>
            )}
          </section>

          {showWait && (
            <section className="space-y-2">
              <p className="text-sm font-medium">2. Wait</p>
              <div className="flex flex-wrap gap-2">
                <label className="sr-only" htmlFor={`delay-value-${flowKey}`}>
                  Delay value
                </label>
                <input
                  id={`delay-value-${flowKey}`}
                  type="number"
                  min={0}
                  className={`${fieldClass} max-w-[6rem]`}
                  value={delayValue}
                  onChange={(event) =>
                    setDelayValue(Math.max(0, Math.round(Number(event.target.value) || 0)))
                  }
                />
                <label className="sr-only" htmlFor={`delay-unit-${flowKey}`}>
                  Delay unit
                </label>
                <select
                  id={`delay-unit-${flowKey}`}
                  className={`${fieldClass} max-w-[9rem]`}
                  value={delayUnit}
                  onChange={(event) => setDelayUnit(event.target.value as OrderFlowDelayUnit)}
                >
                  <option value="minutes">minutes</option>
                  <option value="hours">hours</option>
                  <option value="days">days</option>
                </select>
              </div>
            </section>
          )}

          {showOnlyIf && (
            <section className="space-y-2">
              <p className="text-sm font-medium">3. Only if (optional)</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-1">
                  <span className="text-sm">Cart / order value at least</span>
                  <input
                    type="number"
                    min={0}
                    className={fieldClass}
                    placeholder="e.g. 500"
                    value={onlyIf.minCartValue ?? ''}
                    onChange={(event) =>
                      setOnlyIf((current) => ({
                        ...current,
                        minCartValue: event.target.value
                          ? Math.max(0, Number(event.target.value))
                          : null,
                      }))
                    }
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-sm">Payment type</span>
                  <select
                    className={fieldClass}
                    value={onlyIf.paymentType ?? 'any'}
                    onChange={(event) =>
                      setOnlyIf((current) => ({
                        ...current,
                        paymentType: event.target.value as OrderFlowOnlyIf['paymentType'],
                      }))
                    }
                  >
                    <option value="any">Any</option>
                    <option value="prepaid">Prepaid</option>
                    <option value="cod">COD</option>
                  </select>
                </label>
              </div>
            </section>
          )}

          <section className="space-y-2">
            <p className="text-sm font-medium">
              {showOnlyIf ? '4' : showWait ? '3' : '2'}. Send this template
            </p>
            <label className="block space-y-1">
              <span className="sr-only">Template</span>
              <select
                className={fieldClass}
                value={templateKey(templateName, templateLanguage)}
                onChange={(event) => {
                  const [name, language] = event.target.value.split('|');
                  setTemplateName(name || null);
                  setTemplateLanguage(language || null);
                  setMessage(null);
                }}
              >
                <option value="">Choose a template</option>
                {templateName && templateLanguage && !selected && (
                  <option value={templateKey(templateName, templateLanguage)}>
                    {templateName} (not approved any more)
                  </option>
                )}
                {templates.map((item) => (
                  <option key={item.id} value={templateKey(item.name, item.language)}>
                    {item.name} ({item.language}
                    {item.buttonUrlParamCount > 0 ? ', link button' : ''})
                  </option>
                ))}
              </select>
              {selected ? (
                <span className="text-muted-foreground block text-xs whitespace-pre-line">
                  {selected.body}
                </span>
              ) : (
                <span className="text-muted-foreground block text-xs">
                  Suggested Meta name: {starter.name} ({starter.category.toLowerCase()})
                </span>
              )}
            </label>
          </section>

          <section className="space-y-2">
            <p className="text-sm font-medium">
              {showOnlyIf ? '5' : showWait ? '4' : '3'}. Fill the blanks
            </p>
            {blankSlots.length === 0 && !(selected && selected.buttonUrlParamCount > 0) ? (
              <p className="text-muted-foreground text-sm">
                Pick a template with placeholders, or map fields after you choose one.
              </p>
            ) : (
              <div className="space-y-2">
                {blankSlots.map((slot) => (
                  <label key={slot} className="grid grid-cols-[3rem_1fr] items-center gap-2">
                    <span className="text-muted-foreground text-sm">{`{{${slot}}}`}</span>
                    <select
                      className={fieldClass}
                      value={variableMap[slot] ?? ''}
                      onChange={(event) =>
                        setVariable(slot, event.target.value as OrderFlowVariableField | '')
                      }
                    >
                      <option value="">Choose field</option>
                      {ORDER_FLOW_VARIABLE_FIELDS.map((field) => (
                        <option key={field.key} value={field.key}>
                          {field.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
                {(selected?.buttonUrlParamCount ?? 0) > 0 && (
                  <label className="grid grid-cols-[3rem_1fr] items-center gap-2 sm:grid-cols-[5.5rem_1fr]">
                    <span className="text-muted-foreground text-sm">Button link</span>
                    <select
                      className={fieldClass}
                      value={variableMap.button_url ?? ''}
                      onChange={(event) =>
                        setVariable(
                          'button_url',
                          event.target.value as OrderFlowVariableField | ''
                        )
                      }
                    >
                      <option value="">Choose field</option>
                      {ORDER_FLOW_VARIABLE_FIELDS.filter((f) => f.key.endsWith('_link')).map(
                        (field) => (
                          <option key={field.key} value={field.key}>
                            {field.label}
                          </option>
                        )
                      )}
                    </select>
                  </label>
                )}
              </div>
            )}
          </section>

          <section className="space-y-2">
            <p className="text-sm font-medium">
              {showOnlyIf ? '6' : showWait ? '5' : '4'}. Stop if
            </p>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={Boolean(stopIf.onOrderPlaced)}
                onChange={(event) =>
                  setStopIf((current) => ({
                    ...current,
                    onOrderPlaced: event.target.checked,
                  }))
                }
              />
              the order gets placed
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={Boolean(stopIf.onStopReply)}
                onChange={(event) =>
                  setStopIf((current) => ({
                    ...current,
                    onStopReply: event.target.checked,
                  }))
                }
              />
              the customer replies STOP
            </label>
          </section>

          <section className="border-border space-y-2 border-t pt-4">
            <p className="text-sm font-medium">Send a test to my number</p>
            <div className="flex flex-wrap gap-2">
              <label className="sr-only" htmlFor={`test-phone-${flowKey}`}>
                Test phone number
              </label>
              <input
                id={`test-phone-${flowKey}`}
                type="tel"
                className={`${fieldClass} max-w-[14rem]`}
                placeholder="+91 98765 43210"
                value={testPhone}
                onChange={(event) => setTestPhone(event.target.value)}
              />
              <Button
                type="button"
                variant="secondary"
                disabled={testing || !templateName}
                onClick={() => void sendTest()}
              >
                {testing ? 'Sending…' : 'Send a test to my number'}
              </Button>
            </div>
            <p className="text-muted-foreground text-xs">
              Saves the current template mapping, then sends with sample values.
            </p>
          </section>
        </div>

        <div className="lg:sticky lg:top-4 lg:self-start">
          <PhonePreview
            businessName={storeName || whatsapp.data?.number?.verifiedName || 'WhatsApp'}
            body={previewBody}
            buttonText={previewButton}
          />
        </div>
      </div>
    </div>
  );
}
