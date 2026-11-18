'use client';

import { useMemo, useState } from 'react';
import { apiFetch, ApiError } from '@/shared/lib/fetcher';
import type { PortalLeadRow, PortalLeadsSummary } from '@/modules/social/server/portal/portal-leads.service';

const STAGE_OPTIONS = [
  { id: 'new', label: 'New' },
  { id: 'contacted', label: 'Contacted' },
  { id: 'qualified', label: 'Qualified' },
  { id: 'won', label: 'Won' },
  { id: 'lost', label: 'Lost' },
] as const;

const STAGE_LABELS: Record<string, string> = Object.fromEntries(
  STAGE_OPTIONS.map((option) => [option.id, option.label])
);

function totalsFrom(leads: PortalLeadRow[]) {
  const byStage: Record<string, number> = {};
  for (const lead of leads) {
    byStage[lead.stage] = (byStage[lead.stage] ?? 0) + 1;
  }
  return { all: leads.length, byStage };
}

export function PortalLeadsPanel({
  data,
  canAct = false,
}: {
  data: PortalLeadsSummary;
  /** False when the agency set Leads to "View only": stage is read-only. */
  canAct?: boolean;
}) {
  const [leads, setLeads] = useState(data.leads);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const totals = useMemo(() => totalsFrom(leads), [leads]);
  const stages = Object.keys(totals.byStage).sort();

  async function changeStage(leadId: string, stage: string) {
    if (!canAct) return;
    setPendingId(leadId);
    setError(null);
    try {
      const res = await apiFetch<{ lead: PortalLeadRow }>(`/api/portal/leads/${leadId}/stage`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage }),
      });
      setLeads((rows) => rows.map((row) => (row.id === leadId ? res.lead : row)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update lead status.');
    } finally {
      setPendingId(null);
    }
  }

  return (
    <>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-foreground">Leads</h2>
        <p className="mt-1 text-muted-foreground">
          {canAct
            ? 'Leads from ads, WhatsApp, and forms — update status as you work them.'
            : 'Leads from ads, WhatsApp, and forms for your brand.'}
        </p>
      </div>

      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}

      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">Total shown</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{totals.all}</p>
        </div>
        {stages.map((stage) => (
          <div key={stage} className="rounded-xl border border-border bg-surface p-4 shadow-sm">
            <p className="text-sm text-muted-foreground">{STAGE_LABELS[stage] ?? stage}</p>
            <p className="mt-1 text-2xl font-bold text-foreground">{totals.byStage[stage]}</p>
          </div>
        ))}
      </div>

      {leads.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-12 text-center text-muted-foreground">
          No leads yet for your brand.
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
          {leads.map((lead) => (
            <li
              key={lead.id}
              className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {lead.name || lead.email || lead.phone || 'Lead'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {[lead.email, lead.phone].filter(Boolean).join(' · ') || 'No contact yet'}
                  {' · '}
                  {lead.source}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-3 text-xs text-muted-foreground">
                {canAct ? (
                  <select
                    className="rounded-lg border border-border bg-surface px-2 py-1 text-xs font-medium text-foreground"
                    value={lead.stage}
                    disabled={pendingId === lead.id}
                    onChange={(event) => void changeStage(lead.id, event.target.value)}
                    aria-label={`Status for ${lead.name || lead.email || 'lead'}`}
                  >
                    {STAGE_OPTIONS.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="rounded-full bg-surface-muted px-2 py-0.5 font-medium text-foreground">
                    {STAGE_LABELS[lead.stage] ?? lead.stage}
                  </span>
                )}
                {lead.score != null ? <span>Score {lead.score}</span> : null}
                <span>{new Date(lead.createdAt).toLocaleDateString()}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
