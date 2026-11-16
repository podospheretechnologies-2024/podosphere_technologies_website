'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Modal } from '@/shared/components/ui/modal';
import { apiFetch } from '@/shared/lib/fetcher';
import { useClientScopeKey } from '../../hooks/use-client-scope';
import { useWhatsApp } from '../../hooks/use-whatsapp';
import type { LeadWhatsAppChat, LeadWhatsAppSendResult } from '../../types/whatsapp-lead-flow';
import { sendableTemplates, templateKey } from '../whatsapp/lead-flow-card';

const STAGES = [
  { id: 'new', label: 'New' },
  { id: 'contacted', label: 'Contacted' },
  { id: 'qualified', label: 'Qualified' },
  { id: 'won', label: 'Won' },
  { id: 'lost', label: 'Lost' },
] as const;

type LeadStage = (typeof STAGES)[number]['id'];

interface Lead {
  id: string;
  source: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  stage: string;
  score: number | null;
  scoreReasons: string[];
  scoredAt: string | null;
  crmSyncedAt: string | null;
  crmExternalId: string | null;
  adName: string | null;
  waStep: number;
  waLastSentAt: string | null;
  waNextAt: string | null;
  waRepliedAt: string | null;
  waError: string | null;
  createdAt: string;
}

const shortDateTime = (iso: string) =>
  new Date(iso).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });

/** One short line about where the lead stands on WhatsApp; null when nothing happened yet. */
function whatsAppStatus(lead: Lead): { text: string; bad: boolean } | null {
  if (lead.waError) return { text: `WhatsApp failed: ${lead.waError}`, bad: true };
  if (lead.waRepliedAt) return { text: 'Replied on WhatsApp', bad: false };
  if (lead.waStep === 0) return null;
  const sent = lead.waStep === 1 ? 'WhatsApp sent' : `WhatsApp sent, ${lead.waStep - 1} follow-up`;
  const next = lead.waNextAt ? `, next ${shortDateTime(lead.waNextAt)}` : '';
  return { text: sent + next, bad: false };
}

export function LeadsPanel() {
  const scopeKey = useClientScopeKey();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const whatsapp = useWhatsApp();
  const templates = whatsapp.data?.configured ? sendableTemplates(whatsapp.data.templates) : [];
  const [selected, setSelected] = useState<string[]>([]);
  const [template, setTemplate] = useState('');
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<LeadWhatsAppSendResult | null>(null);
  const [chatLead, setChatLead] = useState<Lead | null>(null);
  const [chat, setChat] = useState<LeadWhatsAppChat | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);

  function loadLeads() {
    return apiFetch<Lead[]>('/api/social/leads')
      .then(setLeads)
      .catch((err: Error) => setError(err.message));
  }

  useEffect(() => {
    void apiFetch<Lead[]>('/api/social/leads')
      .then((rows) => {
        setLeads(rows);
        setSelected([]);
        setSendResult(null);
      })
      .catch((err: Error) => setError(err.message));
  }, [scopeKey]);

  function toggle(leadId: string) {
    setSelected((prev) =>
      prev.includes(leadId) ? prev.filter((id) => id !== leadId) : [...prev, leadId]
    );
  }

  async function sendWhatsApp() {
    const [templateName, language] = template.split('|');
    if (!templateName || !language || selected.length === 0) return;
    if (
      !window.confirm(
        `Send the template "${templateName}" to ${selected.length} lead(s) on WhatsApp? Meta charges for each message.`
      )
    ) {
      return;
    }
    setSending(true);
    setError(null);
    setSendResult(null);
    try {
      const result = await apiFetch<LeadWhatsAppSendResult>('/api/social/leads/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadIds: selected, templateName, language }),
      });
      setSendResult(result);
      setSelected(result.failed.map((item) => item.leadId));
      await loadLeads();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send');
    } finally {
      setSending(false);
    }
  }

  function openChat(lead: Lead) {
    setChatLead(lead);
    setChat(null);
    setChatError(null);
    apiFetch<LeadWhatsAppChat>(`/api/social/leads/${lead.id}/whatsapp`)
      .then(setChat)
      .catch((err: Error) => setChatError(err.message));
  }

  async function moveStage(leadId: string, stage: LeadStage) {
    setSavingId(leadId);
    setError(null);
    try {
      const response = await fetch(`/api/social/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage }),
      });
      const payload = (await response.json()) as Lead | { error?: string };
      if (!response.ok) {
        throw new Error('error' in payload ? (payload.error ?? 'Could not update stage') : 'Could not update stage');
      }
      const updated = payload as Lead;
      setLeads((prev) => prev.map((lead) => (lead.id === leadId ? { ...lead, ...updated } : lead)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update stage');
    } finally {
      setSavingId(null);
    }
  }

  async function scoreLead(leadId: string) {
    setBusyId(leadId);
    setError(null);
    try {
      const response = await fetch(`/api/social/leads/${leadId}/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pushToCrm: false }),
      });
      const payload = (await response.json()) as Lead | { error?: string };
      if (!response.ok) {
        throw new Error('error' in payload ? (payload.error ?? 'Could not score lead') : 'Could not score lead');
      }
      const updated = payload as Lead;
      setLeads((prev) => prev.map((lead) => (lead.id === leadId ? { ...lead, ...updated } : lead)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not score lead');
    } finally {
      setBusyId(null);
    }
  }

  async function pushLead(leadId: string) {
    setBusyId(leadId);
    setError(null);
    try {
      const response = await fetch(`/api/social/leads/${leadId}/push`, { method: 'POST' });
      const payload = (await response.json()) as Lead | { error?: string };
      if (!response.ok) {
        throw new Error('error' in payload ? (payload.error ?? 'Could not push to CRM') : 'Could not push to CRM');
      }
      const updated = payload as Lead;
      setLeads((prev) => prev.map((lead) => (lead.id === leadId ? { ...lead, ...updated } : lead)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not push to CRM');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-danger text-sm">{error}</p>}
      {templates.length > 0 && leads.length > 0 && (
        <div className="border-border bg-surface flex flex-wrap items-center gap-2 rounded-xl border p-3">
          <span className="text-sm font-medium">
            {selected.length > 0 ? `${selected.length} selected` : 'Tick leads to message them'}
          </span>
          <select
            aria-label="WhatsApp template"
            className="border-border bg-background h-8 min-w-0 flex-1 rounded-lg border px-2 text-sm"
            value={template}
            onChange={(event) => setTemplate(event.target.value)}
          >
            <option value="">Choose a WhatsApp template</option>
            {templates.map((item) => (
              <option key={item.id} value={templateKey(item.name, item.language)}>
                {item.name} ({item.language})
              </option>
            ))}
          </select>
          <Button
            size="sm"
            disabled={sending || selected.length === 0 || !template}
            onClick={() => void sendWhatsApp()}
          >
            {sending ? 'Sending…' : 'Send WhatsApp'}
          </Button>
        </div>
      )}
      {sendResult && (
        <div className="border-border rounded-xl border p-3 text-sm" role="status">
          <p>
            Sent to {sendResult.sent.length} lead(s)
            {sendResult.failed.length > 0 ? `, ${sendResult.failed.length} not sent:` : '.'}
          </p>
          {sendResult.failed.length > 0 && (
            <ul className="text-danger mt-1 list-disc pl-5 text-xs">
              {sendResult.failed.map((item) => (
                <li key={item.leadId}>
                  {item.name}: {item.reason}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
        {STAGES.map((column) => {
          const columnLeads = leads.filter((lead) => lead.stage === column.id);
          return (
            <section key={column.id} className="border-border bg-surface-muted/30 min-h-64 rounded-2xl border p-3">
              <header className="mb-3 flex items-center justify-between gap-2">
                <h3 className="text-sm font-medium">{column.label}</h3>
                <span className="text-muted-foreground text-xs">{columnLeads.length}</span>
              </header>
              <ul className="space-y-2">
                {columnLeads.map((lead) => {
                  const waStatus = whatsAppStatus(lead);
                  return (
                  <li key={lead.id} className="border-border bg-background rounded-xl border p-3">
                    <div className="flex items-start justify-between gap-2">
                      {templates.length > 0 && (
                        <input
                          type="checkbox"
                          className="mt-0.5 h-4 w-4 shrink-0"
                          aria-label={`Select ${lead.name || 'lead'}`}
                          checked={selected.includes(lead.id)}
                          onChange={() => toggle(lead.id)}
                        />
                      )}
                      <p className="min-w-0 flex-1 text-sm font-medium">{lead.name || 'Untitled lead'}</p>
                      {lead.score != null && (
                        <span className="border-border text-muted-foreground shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-medium">
                          {lead.score}
                        </span>
                      )}
                    </div>
                    <p className="text-muted-foreground mt-0.5 truncate text-xs">
                      {lead.source === 'whatsapp_ad' ? 'WhatsApp ad' : lead.source}
                      {lead.adName ? ` · ${lead.adName}` : ''}
                    </p>
                    <p className="text-muted-foreground truncate text-xs">{lead.phone || lead.email || '—'}</p>
                    {lead.phone && lead.email && (
                      <p className="text-muted-foreground truncate text-xs">{lead.email}</p>
                    )}
                    {waStatus && (
                      <p
                        className={`mt-1 text-[10px] ${waStatus.bad ? 'text-danger' : 'text-muted-foreground'}`}
                      >
                        {waStatus.text}
                      </p>
                    )}
                    {lead.crmSyncedAt && (
                      <p className="text-muted-foreground mt-1 text-[10px]">
                        CRM {new Date(lead.crmSyncedAt).toLocaleDateString()}
                      </p>
                    )}
                    <label className="mt-2 block">
                      <span className="sr-only">Stage</span>
                      <select
                        className="border-border bg-background mt-1 w-full rounded-lg border px-2 py-1 text-xs"
                        value={lead.stage}
                        disabled={savingId === lead.id}
                        onChange={(event) => {
                          void moveStage(lead.id, event.target.value as LeadStage);
                        }}
                      >
                        {STAGES.map((stage) => (
                          <option key={stage.id} value={stage.id}>
                            {stage.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="mt-2 flex flex-wrap gap-1">
                      <button
                        type="button"
                        className="border-border text-muted-foreground hover:bg-surface-muted rounded-md border px-1.5 py-0.5 text-[10px]"
                        disabled={busyId === lead.id}
                        onClick={() => {
                          void scoreLead(lead.id);
                        }}
                      >
                        Score
                      </button>
                      <button
                        type="button"
                        className="border-border text-muted-foreground hover:bg-surface-muted rounded-md border px-1.5 py-0.5 text-[10px]"
                        disabled={busyId === lead.id}
                        onClick={() => {
                          void pushLead(lead.id);
                        }}
                      >
                        Push CRM
                      </button>
                      {lead.phone && (
                        <button
                          type="button"
                          className="border-border text-muted-foreground hover:bg-surface-muted rounded-md border px-1.5 py-0.5 text-[10px]"
                          onClick={() => openChat(lead)}
                        >
                          WhatsApp chat
                        </button>
                      )}
                    </div>
                  </li>
                  );
                })}
                {columnLeads.length === 0 && (
                  <li className="text-muted-foreground px-1 py-4 text-xs">No leads</li>
                )}
              </ul>
            </section>
          );
        })}
      </div>
      {leads.length === 0 && !error && (
        <p className="text-muted-foreground text-sm">Lead-form webhooks will show up here.</p>
      )}
      <Modal
        open={chatLead !== null}
        title={chatLead?.name || chatLead?.phone || 'WhatsApp chat'}
        description={chat?.waId ? `+${chat.waId}` : undefined}
        onClose={() => setChatLead(null)}
      >
        {chatError ? (
          <p className="text-danger text-sm">{chatError}</p>
        ) : !chat ? (
          <p className="text-muted-foreground text-sm">Loading chat…</p>
        ) : chat.messages.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {chat.waId
              ? 'No WhatsApp messages with this lead yet.'
              : 'This lead has no usable phone number.'}
          </p>
        ) : (
          <ul className="max-h-[55vh] space-y-2 overflow-y-auto">
            {chat.messages.map((item) => (
              <li
                key={item.id}
                className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                  item.direction === 'inbound' ? 'bg-surface-muted' : 'bg-primary/10 ml-auto'
                }`}
              >
                <p className="break-words whitespace-pre-wrap">{item.body}</p>
                <p className="text-muted-foreground mt-1 text-[10px]">
                  {item.direction === 'inbound' ? 'Lead' : item.senderLabel || 'You'} ·{' '}
                  {shortDateTime(item.timestamp)}
                  {item.direction === 'outbound' && item.status ? ` · ${item.status}` : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
        <p className="text-muted-foreground mt-4 text-xs">
          To reply, open this chat on the WhatsApp page of the dashboard.
        </p>
      </Modal>
    </div>
  );
}
