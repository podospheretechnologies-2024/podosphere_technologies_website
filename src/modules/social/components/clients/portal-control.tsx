'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowLeft, ArrowUp, Bookmark, Copy, ExternalLink } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { SegmentedControl } from '@/shared/components/ui/segmented-control';
import { apiFetch, ApiError } from '@/shared/lib/fetcher';
import { cn } from '@/shared/lib/cn';
import {
  getPortalTab,
  type PortalAccessLevel,
  type PortalTabId,
} from '@/modules/social/config/portal-tabs';
import type {
  WhatsAppAgencyNotify,
  WhatsAppClientNotify,
} from '@/modules/social/types/whatsapp-agency';

type SettingsPayload = {
  config: { tabs?: Partial<Record<PortalTabId, PortalAccessLevel>> };
  levels: Record<PortalTabId, PortalAccessLevel>;
  order: PortalTabId[];
  adSpendVisible: boolean;
};

type ClientRow = { id: string; name: string };
type ApproverRow = { id: string; disabledAt: string | null };

const READ_ONLY_LEVELS = [
  { value: 'off', label: 'Hidden' },
  { value: 'view', label: 'View only' },
] as const;
const ALL_LEVELS = [...READ_ONLY_LEVELS, { value: 'act', label: 'Can act' }] as const;

const REMINDERS = [
  {
    key: 'approvalEnabled',
    template: 'approvalTemplate',
    label: 'Post approval reminder',
    hint: 'Once a day while posts wait for this client (10am–7pm, max 3 times).',
  },
  {
    key: 'paymentEnabled',
    template: 'paymentTemplate',
    label: 'Payment reminder',
    hint: '3 days before a payment is due, and on the due date.',
  },
  {
    key: 'reportEnabled',
    template: 'reportTemplate',
    label: 'Monthly report',
    hint: 'Sends the monthly PDF report when it is ready.',
  },
] as const;

function message(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

/** Agency screen: decide what one client sees and can do in their portal, and their WhatsApp reminders. */
export function PortalControl({ clientId }: { clientId: string }) {
  const tabsUrl = `/api/social/clients/${clientId}/portal-tabs`;
  const [settings, setSettings] = useState<SettingsPayload | null>(null);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [notify, setNotify] = useState<WhatsAppClientNotify | null>(null);
  const [agencyNotify, setAgencyNotify] = useState<WhatsAppAgencyNotify | null>(null);
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [copyOpen, setCopyOpen] = useState(false);
  const [copyTargets, setCopyTargets] = useState<string[]>([]);
  const [orgDefaultExists, setOrgDefaultExists] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [tabs, clientList, orgDefaults] = await Promise.all([
        apiFetch<SettingsPayload>(tabsUrl),
        apiFetch<ClientRow[]>('/api/social/clients'),
        apiFetch<{ exists: boolean }>('/api/social/clients/portal-tabs/defaults').catch(() => ({
          exists: false,
        })),
      ]);
      setSettings(tabs);
      setClients(clientList.map((row) => ({ id: row.id, name: row.name })));
      setOrgDefaultExists(orgDefaults.exists);
    } catch (err) {
      setError(message(err, 'Could not load portal settings.'));
    }
    // WhatsApp reminders need the inbox permission; the rest of the page works without it.
    try {
      const res = await apiFetch<{ agency: WhatsAppAgencyNotify; clients: WhatsAppClientNotify[] }>(
        '/api/social/whatsapp/agency-notify'
      );
      const row = res.clients.find((item) => item.customerId === clientId) ?? null;
      setAgencyNotify(res.agency);
      setNotify(row);
      setPhone(row?.phone ?? '');
    } catch {
      setNotify(null);
    }
  }, [clientId, tabsUrl]);

  useEffect(() => {
    void load();
  }, [load]);

  const clientName = clients.find((row) => row.id === clientId)?.name ?? 'Client';
  const otherClients = useMemo(
    () => clients.filter((row) => row.id !== clientId),
    [clients, clientId]
  );

  async function saveTabs(body: Record<string, unknown>, key: string) {
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      setSettings(
        await apiFetch<SettingsPayload>(tabsUrl, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      );
    } catch (err) {
      setError(message(err, 'Could not save.'));
    } finally {
      setBusy(null);
    }
  }

  function move(id: PortalTabId, delta: -1 | 1) {
    if (!settings) return;
    const order = [...settings.order];
    const from = order.indexOf(id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= order.length) return;
    [order[from], order[to]] = [order[to]!, order[from]!];
    void saveTabs({ order }, `move-${id}`);
  }

  async function openAsClient() {
    setBusy('open');
    setError(null);
    try {
      const res = await apiFetch<{ approvers: ApproverRow[] }>(
        `/api/social/clients/${clientId}/approvers`
      );
      const approver = res.approvers.find((row) => !row.disabledAt);
      if (!approver) {
        setError('This client has no active login yet. Add one in Clients → Portal access.');
        return;
      }
      const login = await apiFetch<{ redirectTo: string }>(
        `/api/social/clients/${clientId}/portal-login`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ approverId: approver.id }),
        }
      );
      window.open(login.redirectTo, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setError(message(err, 'Could not open the portal.'));
    } finally {
      setBusy(null);
    }
  }

  async function copyToClients() {
    setBusy('copy');
    setError(null);
    setNotice(null);
    try {
      const res = await apiFetch<{ updated: number }>(`${tabsUrl}/copy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetClientIds: copyTargets }),
      });
      setNotice(`Copied these settings to ${res.updated} client${res.updated === 1 ? '' : 's'}.`);
      setCopyOpen(false);
      setCopyTargets([]);
    } catch (err) {
      setError(message(err, 'Could not copy settings.'));
    } finally {
      setBusy(null);
    }
  }

  async function saveAsOrgDefault() {
    const confirmMsg = orgDefaultExists
      ? `Replace the current org default with ${clientName}'s portal tabs? New clients will get these settings; existing clients stay as they are.`
      : `Save ${clientName}'s portal tabs as the default for new clients? Existing clients stay as they are.`;
    if (!window.confirm(confirmMsg)) return;

    setBusy('default');
    setError(null);
    setNotice(null);
    try {
      const res = await apiFetch<{ exists: boolean }>(`${tabsUrl}/defaults`, {
        method: 'POST',
      });
      setOrgDefaultExists(res.exists);
      setNotice(
        res.exists
          ? 'Saved as default for new clients.'
          : 'Default cleared (this client had no tab overrides).'
      );
    } catch (err) {
      setError(message(err, 'Could not save the org default.'));
    } finally {
      setBusy(null);
    }
  }

  async function saveNotify(patch: Partial<WhatsAppClientNotify>, key: string) {
    if (!notify) return;
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      const next = await apiFetch<WhatsAppClientNotify>('/api/social/whatsapp/agency-notify', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: clientId,
          phone: (patch.phone !== undefined ? patch.phone : notify.phone) || null,
          reportEnabled: patch.reportEnabled ?? notify.reportEnabled,
          approvalEnabled: patch.approvalEnabled ?? notify.approvalEnabled,
          paymentEnabled: patch.paymentEnabled ?? notify.paymentEnabled,
        }),
      });
      setNotify(next);
      setPhone(next.phone ?? '');
    } catch (err) {
      setError(message(err, 'Could not save the WhatsApp reminder.'));
    } finally {
      setBusy(null);
    }
  }

  const visibleTabs = settings
    ? settings.order.filter((id) => settings.levels[id] !== 'off')
    : [];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Link
          href="/dashboard/social/clients"
          className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1.5 text-sm"
        >
          <ArrowLeft className="size-3.5" /> Clients
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Portal control · {clientName}</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Choose which tabs this client sees, what they can do, and the order of the left menu.
              Changes apply the next time the client opens a page.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={busy === 'open'}
              onClick={() => void openAsClient()}
            >
              <ExternalLink className="size-3.5" />
              {busy === 'open' ? 'Opening…' : 'Open as client'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={otherClients.length === 0}
              onClick={() => setCopyOpen((open) => !open)}
            >
              <Copy className="size-3.5" />
              Copy to other clients
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={busy === 'default' || !settings}
              onClick={() => void saveAsOrgDefault()}
            >
              <Bookmark className="size-3.5" />
              {busy === 'default' ? 'Saving…' : 'Save as default for new clients'}
            </Button>
          </div>
        </div>
        <p className="text-muted-foreground mt-2 text-xs">
          {orgDefaultExists
            ? 'An org default is set — new clients get those tab levels, order and ad-spend settings.'
            : 'No org default yet — new clients start with automatic tab defaults until you save one.'}
        </p>
      </div>

      {error ? <p className="text-danger text-sm">{error}</p> : null}
      {notice ? <p className="text-success text-sm">{notice}</p> : null}

      {copyOpen ? (
        <div className="border-border bg-surface space-y-3 rounded-xl border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">
              Copy {clientName}&apos;s tabs, levels and order to:
            </p>
            <button
              type="button"
              className="text-primary text-xs font-medium"
              onClick={() =>
                setCopyTargets(
                  copyTargets.length === otherClients.length ? [] : otherClients.map((row) => row.id)
                )
              }
            >
              {copyTargets.length === otherClients.length ? 'Clear all' : 'Select all'}
            </button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
            {otherClients.map((row) => (
              <label key={row.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={copyTargets.includes(row.id)}
                  onChange={(event) =>
                    setCopyTargets((ids) =>
                      event.target.checked ? [...ids, row.id] : ids.filter((id) => id !== row.id)
                    )
                  }
                />
                <span className="truncate">{row.name}</span>
              </label>
            ))}
          </div>
          <p className="text-muted-foreground text-xs">
            This replaces the portal tab settings of the selected clients. Logins and WhatsApp
            reminders are not copied.
          </p>
          <Button
            type="button"
            size="sm"
            disabled={busy === 'copy' || copyTargets.length === 0}
            onClick={() => void copyToClients()}
          >
            {busy === 'copy' ? 'Copying…' : `Copy to ${copyTargets.length} client(s)`}
          </Button>
        </div>
      ) : null}

      {!settings ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_220px]">
          <section className="space-y-3">
            <h2 className="font-medium">Tabs</h2>
            <ul className="divide-border border-border bg-surface divide-y rounded-xl border">
              {settings.order.map((id, index) => {
                const tab = getPortalTab(id);
                if (!tab) return null;
                const Icon = tab.icon;
                const level = settings.levels[id];
                const overridden = settings.config.tabs?.[id] !== undefined;
                return (
                  <li key={id} className="flex flex-wrap items-center gap-3 p-3">
                    <div className="flex flex-col">
                      <button
                        type="button"
                        aria-label={`Move ${tab.label} up`}
                        disabled={index === 0 || busy !== null}
                        onClick={() => move(id, -1)}
                        className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                      >
                        <ArrowUp className="size-4" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Move ${tab.label} down`}
                        disabled={index === settings.order.length - 1 || busy !== null}
                        onClick={() => move(id, 1)}
                        className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                      >
                        <ArrowDown className="size-4" />
                      </button>
                    </div>
                    <Icon
                      className={cn('size-5 shrink-0', level === 'off' && 'text-muted-foreground')}
                    />
                    <div className="min-w-[10rem] flex-1">
                      <p className={cn('text-sm font-medium', level === 'off' && 'text-muted-foreground')}>
                        {tab.label}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {tab.actions ? `Can act: ${tab.actions}` : 'Read-only tab'}
                        {tab.defaultHint ? ` · ${tab.defaultHint}` : ''}
                      </p>
                      {tab.defaultHint && overridden ? (
                        <button
                          type="button"
                          className="text-primary mt-0.5 text-xs font-medium"
                          disabled={busy !== null}
                          onClick={() => void saveTabs({ tabs: { [id]: null } }, `level-${id}`)}
                        >
                          Back to automatic
                        </button>
                      ) : null}
                    </div>
                    <SegmentedControl
                      label={`${tab.label} access`}
                      options={tab.actions ? ALL_LEVELS : READ_ONLY_LEVELS}
                      value={level}
                      disabled={busy === `level-${id}`}
                      onChange={(next) => void saveTabs({ tabs: { [id]: next } }, `level-${id}`)}
                    />
                  </li>
                );
              })}
              <li className="flex flex-wrap items-center justify-between gap-3 p-3">
                <div>
                  <p className="text-sm font-medium">Show ad spend</p>
                  <p className="text-muted-foreground text-xs">
                    Off hides money amounts on Overview, Ads and Growth.
                  </p>
                </div>
                <SegmentedControl
                  label="Ad spend"
                  options={[
                    { value: 'hide', label: 'Hidden' },
                    { value: 'show', label: 'Visible' },
                  ]}
                  value={settings.adSpendVisible ? 'show' : 'hide'}
                  disabled={busy === 'adSpend'}
                  onChange={(next) => void saveTabs({ adSpendVisible: next === 'show' }, 'adSpend')}
                />
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-medium">Client&apos;s left menu</h2>
            <div className="border-border bg-surface-muted/40 rounded-xl border p-3">
              {visibleTabs.length === 0 ? (
                <p className="text-muted-foreground text-xs">
                  Every tab is hidden. The client will not be able to open the portal.
                </p>
              ) : (
                <ul className="bg-surface mx-auto flex w-20 flex-col items-center gap-1 rounded-xl p-2">
                  {visibleTabs.map((id, index) => {
                    const tab = getPortalTab(id);
                    if (!tab) return null;
                    const Icon = tab.icon;
                    return (
                      <li
                        key={id}
                        className={cn(
                          'flex w-full flex-col items-center gap-1 rounded-xl px-1 py-2 text-[10px] font-semibold',
                          index === 0 ? 'bg-foreground text-background' : 'text-muted-foreground'
                        )}
                      >
                        <Icon className="size-5" />
                        {tab.label}
                      </li>
                    );
                  })}
                </ul>
              )}
              <p className="text-muted-foreground mt-3 text-center text-xs">
                The first tab is the client&apos;s home page.
              </p>
            </div>
          </section>
        </div>
      )}

      {notify ? (
        <section className="space-y-3">
          <div>
            <h2 className="font-medium">WhatsApp reminders for this client</h2>
            <p className="text-muted-foreground text-sm">
              Sent from the agency WhatsApp number to the number below. Each reminder uses the
              approved template picked in WhatsApp → Agency notify.
            </p>
          </div>
          <div className="border-border bg-surface divide-border divide-y rounded-xl border">
            <div className="flex flex-wrap items-end gap-2 p-3">
              <div>
                <label htmlFor="portal-wa-phone" className="mb-1 block text-xs font-medium">
                  Client WhatsApp number (with country code)
                </label>
                <Input
                  id="portal-wa-phone"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="+9198…"
                  className="max-w-[220px]"
                />
              </div>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={busy === 'phone' || phone.trim() === (notify.phone ?? '')}
                onClick={() => void saveNotify({ phone: phone.trim() || null }, 'phone')}
              >
                {busy === 'phone' ? 'Saving…' : 'Save number'}
              </Button>
            </div>
            {REMINDERS.map((reminder) => {
              const hasTemplate = Boolean(agencyNotify?.[reminder.template]);
              const on = notify[reminder.key];
              return (
                <div key={reminder.key} className="flex flex-wrap items-center justify-between gap-3 p-3">
                  <div>
                    <p className="text-sm font-medium">{reminder.label}</p>
                    <p className="text-muted-foreground text-xs">{reminder.hint}</p>
                    {!hasTemplate ? (
                      <p className="text-danger text-xs">
                        No template picked yet, so nothing is sent.{' '}
                        <Link href="/dashboard/social/whatsapp" className="underline">
                          Pick it in WhatsApp
                        </Link>
                      </p>
                    ) : null}
                  </div>
                  <SegmentedControl
                    label={reminder.label}
                    options={[
                      { value: 'off', label: 'Off' },
                      { value: 'on', label: 'On' },
                    ]}
                    value={on ? 'on' : 'off'}
                    disabled={busy === reminder.key}
                    onChange={(next) =>
                      void saveNotify({ [reminder.key]: next === 'on' }, reminder.key)
                    }
                  />
                </div>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}
