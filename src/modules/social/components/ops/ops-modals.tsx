'use client';

import { useState } from 'react';
import {
  OPS_CLIENT_STATUSES,
  OPS_CLIENT_STATUS_LABEL,
  OPS_ENGAGEMENT_TYPES,
  OPS_SERVICE_CATEGORIES,
  OPS_SERVICE_CATEGORY_LABEL,
  OPS_SERVICE_SUBTYPES,
  type OpsServiceCategory,
} from '@/modules/social/server/ops/ops.constants';
import { useClientScopeState } from '../../hooks/use-client-scope';
import { opsCall, type OpsClient } from './ops-api';

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-surface border-border max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border shadow-xl">
        <div className="border-border flex items-center justify-between border-b px-5 py-4">
          <h2 className="text-base font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-sm"
          >
            Close
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

type ServiceDraft = { category: OpsServiceCategory; subtype: string; groupLabel: string };

export function AddClientModal({
  onClose,
  onSaved,
  initial,
}: {
  onClose: () => void;
  onSaved: () => void;
  initial?: OpsClient | null;
}) {
  const editing = Boolean(initial);
  const [name, setName] = useState(initial?.name ?? '');
  const [status, setStatus] = useState(initial?.status ?? 'not_started');
  // PS-12: link the desk row to the Social client of the same brand.
  const { data: scopeState } = useClientScopeState();
  const socialClients = scopeState?.clients ?? [];
  const [socialCustomerId, setSocialCustomerId] = useState(initial?.socialCustomerId ?? '');
  const [engagementType, setEngagementType] = useState(initial?.engagementType ?? 'retainer');
  const [monthlyFee, setMonthlyFee] = useState(
    initial?.monthlyFee != null ? String(initial.monthlyFee) : ''
  );
  const [teamNames, setTeamNames] = useState(initial?.teamNames ?? '');
  const [retainerStart, setRetainerStart] = useState(initial?.retainerStart ?? '');
  const [retainerMonths, setRetainerMonths] = useState(
    initial?.retainerMonths != null ? String(initial.retainerMonths) : ''
  );
  const [services, setServices] = useState<ServiceDraft[]>(
    (initial?.services ?? []).map((s) => ({
      category: s.category,
      subtype: s.subtype,
      groupLabel: s.groupLabel ?? '',
    }))
  );
  const [categoryPick, setCategoryPick] = useState<OpsServiceCategory>('website');
  const [subtypePick, setSubtypePick] = useState('Website Management');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addService() {
    const group =
      OPS_SERVICE_SUBTYPES[categoryPick]
        .flatMap((g) => g.subtypes.map((subtype) => ({ groupLabel: g.groupLabel, subtype })))
        .find((x) => x.subtype === subtypePick)?.groupLabel ?? '';
    if (services.some((s) => s.category === categoryPick && s.subtype === subtypePick)) return;
    setServices((prev) => [
      ...prev,
      { category: categoryPick, subtype: subtypePick, groupLabel: group },
    ]);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const body = {
      name,
      status,
      engagementType: engagementType || null,
      socialCustomerId: socialCustomerId || null,
      monthlyFee: monthlyFee === '' ? null : Number(monthlyFee),
      teamNames: teamNames || null,
      retainerStart: retainerStart || null,
      retainerMonths: retainerMonths === '' ? null : Number(retainerMonths),
      services: services.map((s) => ({
        category: s.category,
        subtype: s.subtype,
        groupLabel: s.groupLabel || null,
      })),
    };
    try {
      if (editing && initial) {
        await opsCall(`/clients/${initial.id}`, 'PATCH', body);
      } else {
        await opsCall('/clients', 'POST', body);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  const subtypeOptions = OPS_SERVICE_SUBTYPES[categoryPick].flatMap((g) => g.subtypes);

  return (
    <ModalShell title={editing ? 'Edit client' : 'Add client'} onClose={onClose}>
      <form onSubmit={save} className="space-y-4">
        <label className="block space-y-1 text-sm">
          <span className="text-muted-foreground">Client name</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border-border bg-background w-full rounded-lg border px-3 py-2"
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="text-muted-foreground">Linked Social client</span>
          <select
            value={socialCustomerId}
            onChange={(e) => setSocialCustomerId(e.target.value)}
            className="border-border bg-background w-full rounded-lg border px-3 py-2"
          >
            <option value="">Not linked</option>
            {socialClients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1 text-sm">
            <span className="text-muted-foreground">Status</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as typeof status)}
              className="border-border bg-background w-full rounded-lg border px-3 py-2"
            >
              {OPS_CLIENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {OPS_CLIENT_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-muted-foreground">Engagement</span>
            <select
              value={engagementType ?? ''}
              onChange={(e) => setEngagementType(e.target.value)}
              className="border-border bg-background w-full rounded-lg border px-3 py-2"
            >
              {OPS_ENGAGEMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t === 'one_time' ? 'One-time' : t[0]!.toUpperCase() + t.slice(1)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1 text-sm">
            <span className="text-muted-foreground">Monthly fee (₹)</span>
            <input
              type="number"
              min={0}
              value={monthlyFee}
              onChange={(e) => setMonthlyFee(e.target.value)}
              className="border-border bg-background w-full rounded-lg border px-3 py-2"
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-muted-foreground">Team</span>
            <input
              value={teamNames}
              onChange={(e) => setTeamNames(e.target.value)}
              placeholder="Rohit, Nisha"
              className="border-border bg-background w-full rounded-lg border px-3 py-2"
            />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1 text-sm">
            <span className="text-muted-foreground">Retainer start</span>
            <input
              type="date"
              value={retainerStart}
              onChange={(e) => setRetainerStart(e.target.value)}
              className="border-border bg-background w-full rounded-lg border px-3 py-2"
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-muted-foreground">Duration (months)</span>
            <input
              type="number"
              min={1}
              value={retainerMonths}
              onChange={(e) => setRetainerMonths(e.target.value)}
              className="border-border bg-background w-full rounded-lg border px-3 py-2"
            />
          </label>
        </div>

        <div className="space-y-2">
          <p className="text-muted-foreground text-sm">Services</p>
          <div className="flex flex-wrap gap-2">
            <select
              value={categoryPick}
              onChange={(e) => {
                const cat = e.target.value as OpsServiceCategory;
                setCategoryPick(cat);
                setSubtypePick(OPS_SERVICE_SUBTYPES[cat][0]!.subtypes[0]!);
              }}
              className="border-border bg-background rounded-lg border px-2 py-1.5 text-sm"
            >
              {OPS_SERVICE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {OPS_SERVICE_CATEGORY_LABEL[c]}
                </option>
              ))}
            </select>
            <select
              value={subtypePick}
              onChange={(e) => setSubtypePick(e.target.value)}
              className="border-border bg-background rounded-lg border px-2 py-1.5 text-sm"
            >
              {subtypeOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={addService}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white"
            >
              Add
            </button>
          </div>
          <ul className="space-y-1">
            {services.map((s) => (
              <li
                key={`${s.category}-${s.subtype}`}
                className="border-border flex items-center justify-between rounded-lg border px-3 py-1.5 text-sm"
              >
                <span>
                  {OPS_SERVICE_CATEGORY_LABEL[s.category]} · {s.subtype}
                </span>
                <button
                  type="button"
                  className="text-red-600 text-xs"
                  onClick={() =>
                    setServices((prev) =>
                      prev.filter((x) => !(x.category === s.category && x.subtype === s.subtype))
                    )
                  }
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="border-border rounded-lg border px-4 py-2 text-sm"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Add client'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

export function AddPaymentModal({
  clients,
  monthKey,
  onClose,
  onSaved,
}: {
  clients: OpsClient[];
  monthKey: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [clientId, setClientId] = useState(clients[0]?.id ?? '');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId) {
      setError('Pick a client');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await opsCall('/payments', 'POST', {
        clientId,
        amount: amount === '' ? null : Number(amount),
        description: description || null,
        dueDate: dueDate || null,
        monthKey,
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell title="Add payment" onClose={onClose}>
      <form onSubmit={save} className="space-y-4">
        <label className="block space-y-1 text-sm">
          <span className="text-muted-foreground">Client</span>
          <select
            required
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="border-border bg-background w-full rounded-lg border px-3 py-2"
          >
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1 text-sm">
          <span className="text-muted-foreground">Amount (₹)</span>
          <input
            type="number"
            min={0}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="border-border bg-background w-full rounded-lg border px-3 py-2"
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="text-muted-foreground">Description</span>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Monthly retainer"
            className="border-border bg-background w-full rounded-lg border px-3 py-2"
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="text-muted-foreground">Due date</span>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="border-border bg-background w-full rounded-lg border px-3 py-2"
          />
        </label>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="border-border rounded-lg border px-4 py-2 text-sm"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Add payment'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
