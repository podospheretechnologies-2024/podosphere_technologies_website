'use client';

import { useMemo, useState } from 'react';
import {
  OPS_CLIENT_STATUSES,
  OPS_CLIENT_STATUS_LABEL,
  OPS_SERVICE_CATEGORIES,
  OPS_SERVICE_CATEGORY_LABEL,
  type OpsClientStatus,
  type OpsServiceCategory,
} from '@/modules/social/server/ops/ops.constants';
import { formatInr, opsCall, useOpsClients, type OpsClient } from './ops-api';
import { AddClientModal } from './ops-modals';

const STATUS_DOT: Record<OpsClientStatus, string> = {
  not_started: 'bg-gray-400',
  in_progress: 'bg-blue-500',
  active: 'bg-emerald-500',
  on_hold: 'bg-orange-500',
  completed: 'bg-indigo-600',
  lost: 'bg-red-500',
};

const SERVICE_PILL: Partial<Record<OpsServiceCategory, { label: string; className: string }>> = {
  website: { label: 'Web', className: 'bg-violet-100 text-violet-700' },
  social_media: { label: 'SMM', className: 'bg-pink-100 text-pink-700' },
  paid_ads: { label: 'Ads', className: 'bg-orange-100 text-orange-700' },
  ecommerce: { label: 'E-com', className: 'bg-blue-100 text-blue-700' },
  quick_commerce: { label: 'Q-com', className: 'bg-emerald-100 text-emerald-700' },
};

export function OpsClientsTab({
  onAddClient,
}: {
  onAddClient: () => void;
}) {
  const { data: clients = [], error, isLoading, mutate } = useOpsClients();
  const [view, setView] = useState<'kanban' | 'table'>('kanban');
  const [serviceFilter, setServiceFilter] = useState<'all' | OpsServiceCategory>('all');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | OpsClientStatus>('all');
  const [editing, setEditing] = useState<OpsClient | null>(null);

  const filtered = useMemo(() => {
    return clients.filter((c) => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (serviceFilter !== 'all' && !c.services.some((s) => s.category === serviceFilter)) {
        return false;
      }
      if (query.trim()) {
        const q = query.toLowerCase();
        const hay = `${c.name} ${c.teamNames ?? ''} ${c.notes ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [clients, serviceFilter, query, statusFilter]);

  const serviceCounts = useMemo(() => {
    const counts = Object.fromEntries(OPS_SERVICE_CATEGORIES.map((c) => [c, 0])) as Record<
      OpsServiceCategory,
      number
    >;
    for (const client of clients) {
      const seen = new Set<string>();
      for (const s of client.services) {
        if (!seen.has(s.category)) {
          counts[s.category] += 1;
          seen.add(s.category);
        }
      }
    }
    return counts;
  }, [clients]);

  async function setStatus(client: OpsClient, status: OpsClientStatus) {
    await opsCall(`/clients/${client.id}`, 'PATCH', { status });
    await mutate();
  }

  if (isLoading) return <p className="text-muted-foreground text-sm">Loading clients…</p>;
  if (error) return <p className="text-sm text-red-600">{error.message}</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <FilterChip active={serviceFilter === 'all'} onClick={() => setServiceFilter('all')}>
          All services
        </FilterChip>
        {OPS_SERVICE_CATEGORIES.map((c) => (
          <FilterChip
            key={c}
            active={serviceFilter === c}
            onClick={() => setServiceFilter(c)}
          >
            {OPS_SERVICE_CATEGORY_LABEL[c]} ({serviceCounts[c]})
          </FilterChip>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search client, team, note…"
          className="border-border bg-background min-w-[200px] flex-1 rounded-lg border px-3 py-2 text-sm"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className="border-border bg-background rounded-lg border px-3 py-2 text-sm"
        >
          <option value="all">All client status</option>
          {OPS_CLIENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {OPS_CLIENT_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <div className="border-border ml-auto flex rounded-lg border p-0.5 text-sm">
          <button
            type="button"
            className={`rounded-md px-3 py-1.5 ${view === 'kanban' ? 'bg-blue-600 text-white' : ''}`}
            onClick={() => setView('kanban')}
          >
            Kanban
          </button>
          <button
            type="button"
            className={`rounded-md px-3 py-1.5 ${view === 'table' ? 'bg-blue-600 text-white' : ''}`}
            onClick={() => setView('table')}
          >
            Table
          </button>
        </div>
      </div>

      {view === 'kanban' ? (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {OPS_CLIENT_STATUSES.map((status) => {
            const col = filtered.filter((c) => c.status === status);
            const retainer = col
              .filter((c) => c.engagementType === 'retainer')
              .reduce((s, c) => s + (c.monthlyFee ?? 0), 0);
            return (
              <div
                key={status}
                className="border-border bg-surface-muted/40 flex w-72 shrink-0 flex-col rounded-xl border"
              >
                <div className="flex items-center gap-2 px-3 py-2.5">
                  <span className={`size-2 rounded-full ${STATUS_DOT[status]}`} />
                  <span className="text-sm font-semibold">{OPS_CLIENT_STATUS_LABEL[status]}</span>
                  <span className="text-muted-foreground text-xs">({col.length})</span>
                </div>
                {status === 'active' && retainer > 0 ? (
                  <p className="text-muted-foreground px-3 pb-2 text-xs">
                    {formatInr(retainer, true)} retainer / month
                  </p>
                ) : null}
                <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-2 pb-3" style={{ maxHeight: '60vh' }}>
                  {col.length === 0 ? (
                    <p className="text-muted-foreground px-2 py-6 text-center text-xs">
                      Drag a client here
                    </p>
                  ) : (
                    col.map((client) => (
                      <ClientCard
                        key={client.id}
                        client={client}
                        onStatus={setStatus}
                        onEdit={() => setEditing(client)}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="border-border overflow-x-auto rounded-xl border">
          <table className="min-w-full text-sm">
            <thead className="bg-surface-muted/50 text-muted-foreground text-left text-xs uppercase">
              <tr>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Services</th>
                <th className="px-4 py-3">Fee / mo</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Team</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {filtered.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="px-4 py-3">
                    <ServicePills client={c} />
                  </td>
                  <td className="px-4 py-3">{formatInr(c.monthlyFee)}</td>
                  <td className="px-4 py-3">{OPS_CLIENT_STATUS_LABEL[c.status]}</td>
                  <td className="text-muted-foreground px-4 py-3">{c.teamNames ?? '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      className="text-blue-600 text-xs font-medium"
                      onClick={() => setEditing(c)}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="text-muted-foreground py-8 text-center text-sm">
          No clients yet.{' '}
          <button type="button" className="text-blue-600 font-medium" onClick={onAddClient}>
            Add client
          </button>
        </div>
      ) : null}

      {editing ? (
        <AddClientModal
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={() => mutate()}
        />
      ) : null}
    </div>
  );
}

function ClientCard({
  client,
  onStatus,
  onEdit,
}: {
  client: OpsClient;
  onStatus: (client: OpsClient, status: OpsClientStatus) => Promise<void>;
  onEdit: () => void;
}) {
  return (
    <div className="border-border bg-surface rounded-xl border p-3 shadow-sm">
      <button type="button" onClick={onEdit} className="w-full text-left">
        <p className="font-semibold leading-tight">{client.name}</p>
        <div className="mt-2">
          <ServicePills client={client} />
        </div>
        <p className="mt-2 text-sm">
          {client.monthlyFee != null
            ? `${formatInr(client.monthlyFee)} / month`
            : 'Fee not set'}
        </p>
      </button>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <span className="bg-surface-muted text-muted-foreground rounded-full px-2 py-0.5 text-[11px]">
          {OPS_CLIENT_STATUS_LABEL[client.status]}
        </span>
        <span className="bg-surface-muted text-muted-foreground rounded-full px-2 py-0.5 text-[11px]">
          {client.engagementType === 'retainer' ? 'Retainer' : 'No payment due'}
        </span>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <p className="text-muted-foreground truncate text-xs">{client.teamNames ?? '—'}</p>
        <select
          value={client.status}
          onChange={(e) => onStatus(client, e.target.value as OpsClientStatus)}
          className="border-border max-w-[110px] rounded-md border bg-transparent px-1.5 py-1 text-[11px]"
        >
          {OPS_CLIENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {OPS_CLIENT_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function ServicePills({ client }: { client: OpsClient }) {
  const cats = [...new Set(client.services.map((s) => s.category))];
  if (cats.length === 0) {
    return <span className="text-muted-foreground text-xs">No services</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {cats.map((c) => {
        const pill = SERVICE_PILL[c];
        if (!pill) return null;
        return (
          <span
            key={c}
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${pill.className}`}
          >
            {pill.label}
          </span>
        );
      })}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
        active
          ? 'bg-blue-600 text-white'
          : 'border-border bg-surface text-muted-foreground border hover:text-foreground'
      }`}
    >
      {children}
    </button>
  );
}
