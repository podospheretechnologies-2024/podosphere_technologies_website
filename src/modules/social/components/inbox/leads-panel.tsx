'use client';

import { useEffect, useState } from 'react';
import { useClientScopeKey } from '../../hooks/use-client-scope';

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
  createdAt: string;
}

export function LeadsPanel() {
  const scopeKey = useClientScopeKey();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    void fetch('/api/social/leads')
      .then(async (response) => {
        const payload = (await response.json()) as Lead[] | { error?: string };
        if (!response.ok) throw new Error('error' in payload ? payload.error : 'Could not load leads');
        setLeads(payload as Lead[]);
      })
      .catch((err: Error) => setError(err.message));
  }, [scopeKey]);

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
      setLeads((prev) => prev.map((lead) => (lead.id === leadId ? { ...lead, stage: updated.stage } : lead)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update stage');
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-danger text-sm">{error}</p>}
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
                {columnLeads.map((lead) => (
                  <li key={lead.id} className="border-border bg-background rounded-xl border p-3">
                    <p className="text-sm font-medium">{lead.name || 'Untitled lead'}</p>
                    <p className="text-muted-foreground mt-0.5 text-xs">{lead.source}</p>
                    <p className="text-muted-foreground truncate text-xs">{lead.email || lead.phone || '—'}</p>
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
                  </li>
                ))}
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
    </div>
  );
}
