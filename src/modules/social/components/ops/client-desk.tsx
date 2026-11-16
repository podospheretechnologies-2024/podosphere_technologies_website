'use client';

import { ChevronLeft, ChevronRight, Download, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { mutate as globalMutate } from 'swr';
import {
  addMonthsToKey,
  monthKeyFromDate,
  monthLabel,
} from '@/modules/social/server/ops/ops.constants';
import { AdminsOnlyNotice } from '../shell/admins-only-notice';
import { useWorkspaceRole } from '../shell/workspace-role-context';
import { OPS_API, useOpsClients } from './ops-api';
import { OpsClientsTab } from './ops-clients-tab';
import { OpsCollectionsTab } from './ops-collections-tab';
import { OpsDashboardTab } from './ops-dashboard-tab';
import { AddClientModal, AddPaymentModal } from './ops-modals';
import { OpsServicesTab } from './ops-services-tab';

type Tab = 'dashboard' | 'clients' | 'collections' | 'services';

const TABS: { id: Tab; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'clients', label: 'Clients' },
  { id: 'collections', label: 'Collections' },
  { id: 'services', label: 'Services' },
];

export function ClientDesk() {
  const { canManageCampaigns } = useWorkspaceRole();
  const [tab, setTab] = useState<Tab>('dashboard');
  const [monthKey, setMonthKey] = useState(() => monthKeyFromDate(new Date()));
  const [showAddClient, setShowAddClient] = useState(false);
  const [showAddPayment, setShowAddPayment] = useState(false);
  const { data: clients = [], mutate: mutateClients } = useOpsClients();

  const clientCount = clients.length;

  const tabs = useMemo(
    () =>
      TABS.map((t) =>
        t.id === 'clients' ? { ...t, label: `Clients${clientCount ? ` (${clientCount})` : ''}` } : t
      ),
    [clientCount]
  );

  function refreshAll() {
    void mutateClients();
    void globalMutate((key) => typeof key === 'string' && key.startsWith(OPS_API));
  }

  function exportCsv() {
    const rows = [
      ['Name', 'Status', 'Engagement', 'Monthly fee', 'Team', 'Services'].join(','),
      ...clients.map((c) =>
        [
          csv(c.name),
          c.status,
          c.engagementType ?? '',
          c.monthlyFee ?? '',
          csv(c.teamNames ?? ''),
          csv(c.services.map((s) => `${s.category}:${s.subtype}`).join('; ')),
        ].join(',')
      ),
    ];
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `client-desk-${monthKey}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!canManageCampaigns) {
    return (
      <AdminsOnlyNotice
        title="Client Desk is for admins"
        description="Only workspace owners and admins can track retainers, collections, and service delivery."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-muted-foreground text-xs font-semibold tracking-[0.14em] uppercase">
            Client Desk · Client Ops
          </p>
          <div className="mt-2 flex flex-wrap gap-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  tab === t.id
                    ? 'bg-foreground text-background'
                    : 'text-muted-foreground hover:bg-surface-muted hover:text-foreground'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="border-border flex items-center rounded-lg border">
            <button
              type="button"
              className="px-2 py-2"
              onClick={() => setMonthKey((m) => addMonthsToKey(m, -1))}
              aria-label="Previous month"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="min-w-[5.5rem] text-center text-sm font-medium">
              {monthLabel(monthKey)}
            </span>
            <button
              type="button"
              className="px-2 py-2"
              onClick={() => setMonthKey((m) => addMonthsToKey(m, 1))}
              aria-label="Next month"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
          <button
            type="button"
            onClick={exportCsv}
            className="border-border inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm"
          >
            <Download className="size-4" />
            Export
          </button>
          <button
            type="button"
            onClick={() => setShowAddPayment(true)}
            className="border-border inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm"
          >
            <Plus className="size-4" />
            Payment
          </button>
          <button
            type="button"
            onClick={() => setShowAddClient(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white"
          >
            <Plus className="size-4" />
            Add client
          </button>
        </div>
      </div>

      {tab === 'dashboard' ? <OpsDashboardTab monthKey={monthKey} /> : null}
      {tab === 'clients' ? <OpsClientsTab onAddClient={() => setShowAddClient(true)} /> : null}
      {tab === 'collections' ? <OpsCollectionsTab monthKey={monthKey} /> : null}
      {tab === 'services' ? <OpsServicesTab monthKey={monthKey} /> : null}

      {showAddClient ? (
        <AddClientModal onClose={() => setShowAddClient(false)} onSaved={refreshAll} />
      ) : null}
      {showAddPayment ? (
        <AddPaymentModal
          clients={clients}
          monthKey={monthKey}
          onClose={() => setShowAddPayment(false)}
          onSaved={refreshAll}
        />
      ) : null}
    </div>
  );
}

function csv(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}
