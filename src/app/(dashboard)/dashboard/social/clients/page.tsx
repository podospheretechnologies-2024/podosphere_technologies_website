'use client';

import { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { Plus, Link as LinkIcon, Check, Ban, BookmarkPlus, LayoutTemplate, Wand2, Pencil } from 'lucide-react';
import { apiFetch } from '@/shared/lib/fetcher';
import { useClientScopeKey } from '@/modules/social/hooks/use-client-scope';

type ClientTemplateListItem = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

type ClientRow = {
  id: string;
  name: string;
  onboardingStep?: string | null;
  approvers: { id: string; name: string | null; email: string }[];
  adAccounts: { id: string; name: string; externalId: string }[];
  googleAdsAccounts: { id: string; name: string; googleCustomerId: string }[];
  integrations: { id: string; name: string; providerIdentifier: string; username: string | null }[];
};

type AssignableAsset = {
  id: string;
  name: string;
  customerId: string | null;
  customerName: string | null;
  providerName?: string;
};

type AssignableResponse = {
  channels: AssignableAsset[];
  adAccounts: AssignableAsset[];
  googleAdAccounts: AssignableAsset[];
};

type LinkForm = {
  name: string;
  approverName: string;
  approverEmail: string;
  integrationIds: string[];
  adAccountIds: string[];
  googleAdAccountIds: string[];
};

const EMPTY_FORM: LinkForm = {
  name: '',
  approverName: '',
  approverEmail: '',
  integrationIds: [],
  adAccountIds: [],
  googleAdAccountIds: [],
};

function toggleId(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((entry) => entry !== id) : [...ids, id];
}

function AssetPicker({
  label,
  description,
  items,
  selectedIds,
  onToggle,
  empty,
}: {
  label: string;
  description?: string;
  items: { id: string; label: string; hint?: string }[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  empty: string;
}) {
  return (
    <div className="space-y-2">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {description ? <p className="text-muted-foreground text-xs">{description}</p> : null}
      </div>
      {items.length === 0 ? (
        <p className="text-muted-foreground text-sm">{empty}</p>
      ) : (
        <div className="bg-surface border-border max-h-48 space-y-1 overflow-y-auto rounded-md border p-2">
          {items.map((item) => (
            <label
              key={item.id}
              className="hover:bg-surface-muted flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-sm"
            >
              <input
                type="checkbox"
                checked={selectedIds.includes(item.id)}
                onChange={() => onToggle(item.id)}
                className="mt-0.5"
              />
              <span>
                {item.label}
                {item.hint ? <span className="text-muted-foreground block text-xs">{item.hint}</span> : null}
              </span>
            </label>
          ))}
        </div>
      )}
      {selectedIds.length > 0 ? (
        <p className="text-muted-foreground text-xs">{selectedIds.length} selected</p>
      ) : null}
    </div>
  );
}

function ChipList({ items }: { items: { id: string; label: string }[] }) {
  if (items.length === 0) {
    return <span className="text-muted-foreground text-xs">Unlinked</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((item) => (
        <span key={item.id} className="bg-primary/10 text-primary rounded px-2 py-1 text-xs font-medium">
          {item.label}
        </span>
      ))}
    </div>
  );
}

export default function ClientsPage() {
  const scopeKey = useClientScopeKey();
  const { data: clients, mutate } = useSWR<ClientRow[]>(['/api/social/clients', scopeKey], ([url]) => apiFetch(url));
  const { data: templates, mutate: mutateTemplates } = useSWR<ClientTemplateListItem[]>(
    ['/api/social/client-templates', scopeKey],
    ([url]) => apiFetch(url)
  );
  const { data: assignable, mutate: mutateAssignable } = useSWR<AssignableResponse>(['/api/social/clients/assignable', scopeKey], async ([url]) => {
    try {
      return await apiFetch<AssignableResponse>(url);
    } catch {
      return { channels: [], adAccounts: [], googleAdAccounts: [] };
    }
  });

  const integrations = assignable?.channels ?? [];
  const adAccounts = assignable?.adAccounts ?? [];
  const googleAdAccounts = assignable?.googleAdAccounts ?? [];

  const [isAdding, setIsAdding] = useState(false);
  const [isFromTemplate, setIsFromTemplate] = useState(false);
  const [editingClient, setEditingClient] = useState<{ id: string; name: string } | null>(null);
  const [form, setForm] = useState<LinkForm>(EMPTY_FORM);
  const [templateForm, setTemplateForm] = useState({
    templateId: '',
    name: '',
    approverName: '',
    approverEmail: '',
  });
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokedId, setRevokedId] = useState<string | null>(null);
  const [savingTemplateId, setSavingTemplateId] = useState<string | null>(null);
  const [savedTemplateId, setSavedTemplateId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function openAdd() {
    setForm(EMPTY_FORM);
    setFormError(null);
    setEditingClient(null);
    setIsFromTemplate(false);
    setIsAdding(true);
  }

  function openEdit(client: ClientRow) {
    setForm({
      name: client.name,
      approverName: '',
      approverEmail: '',
      integrationIds: (client.integrations ?? []).map((channel) => channel.id),
      adAccountIds: (client.adAccounts ?? []).map((account) => account.externalId),
      googleAdAccountIds: (client.googleAdsAccounts ?? []).map((account) => account.googleCustomerId),
    });
    setFormError(null);
    setIsAdding(false);
    setIsFromTemplate(false);
    setEditingClient({ id: client.id, name: client.name });
  }

  function closeForms() {
    setIsAdding(false);
    setIsFromTemplate(false);
    setEditingClient(null);
    setForm(EMPTY_FORM);
    setFormError(null);
  }

  async function handleAddClient(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      await apiFetch('/api/social/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          approverName: form.approverName,
          approverEmail: form.approverEmail,
          integrationIds: form.integrationIds,
          adAccountIds: form.adAccountIds,
          googleAdAccountIds: form.googleAdAccountIds,
        }),
      });
      closeForms();
      mutate();
      mutateAssignable();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not create client');
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateLinks(e: React.FormEvent) {
    e.preventDefault();
    if (!editingClient) return;
    setSaving(true);
    setFormError(null);
    try {
      await apiFetch(`/api/social/clients/${editingClient.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          integrationIds: form.integrationIds,
          adAccountIds: form.adAccountIds,
          googleAdAccountIds: form.googleAdAccountIds,
        }),
      });
      closeForms();
      mutate();
      mutateAssignable();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not update links');
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateFromTemplate(e: React.FormEvent) {
    e.preventDefault();
    await apiFetch('/api/social/client-templates/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(templateForm),
    });
    setTemplateForm({ templateId: '', name: '', approverName: '', approverEmail: '' });
    setIsFromTemplate(false);
    mutate();
  }

  async function saveAsTemplate(client: { id: string; name: string }) {
    const name = window.prompt('Template name', `${client.name} template`);
    if (!name?.trim()) return;
    setSavingTemplateId(client.id);
    try {
      await apiFetch('/api/social/client-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), sourceCustomerId: client.id }),
      });
      setSavedTemplateId(client.id);
      setTimeout(() => setSavedTemplateId(null), 2000);
      mutateTemplates();
    } finally {
      setSavingTemplateId(null);
    }
  }

  async function generateLink(clientId: string) {
    const res = (await apiFetch(`/api/social/clients/${clientId}/magic-link`, { method: 'POST' })) as {
      magicLink: string;
    };
    await navigator.clipboard.writeText(res.magicLink);
    setCopiedId(clientId);
    setTimeout(() => setCopiedId(null), 2000);
  }

  async function revokeLink(clientId: string, approverId?: string) {
    if (!approverId) return;
    setRevokingId(clientId);
    try {
      await apiFetch(`/api/social/clients/${clientId}/revoke-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approverId }),
      });
      setRevokedId(clientId);
      setTimeout(() => setRevokedId(null), 2000);
    } finally {
      setRevokingId(null);
    }
  }

  const editingId = editingClient?.id ?? null;

  function assetHint(asset: AssignableAsset, fallback?: string) {
    const elsewhere = asset.customerId && asset.customerId !== editingId;
    if (elsewhere) return `Currently linked to ${asset.customerName ?? 'another client'}`;
    return fallback;
  }

  const channelItems = integrations.map((channel) => ({
    id: channel.id,
    label: `${channel.name}${channel.providerName ? ` (${channel.providerName})` : ''}`,
    hint: assetHint(channel),
  }));
  const metaAdItems = adAccounts.map((account) => ({
    id: account.id,
    label: account.name,
    hint: assetHint(account, account.id),
  }));
  const googleAdItems = googleAdAccounts.map((account) => ({
    id: account.id,
    label: account.name,
    hint: assetHint(account, account.id),
  }));

  const linkPickers = (
    <>
      <div className="col-span-2">
        <AssetPicker
          label="Link social channels (optional)"
          description="Select every Instagram, Facebook, LinkedIn, or other channel this client owns. Picking a channel already on another client moves it here."
          items={channelItems}
          selectedIds={form.integrationIds}
          onToggle={(id) => setForm((current) => ({ ...current, integrationIds: toggleId(current.integrationIds, id) }))}
          empty="No social channels connected yet. Add them under Channels first."
        />
      </div>
      <div className="col-span-2 grid gap-4 sm:grid-cols-2">
        <AssetPicker
          label="Meta ad accounts (optional)"
          description="Facebook / Instagram Ads. Multiple accounts allowed."
          items={metaAdItems}
          selectedIds={form.adAccountIds}
          onToggle={(id) => setForm((current) => ({ ...current, adAccountIds: toggleId(current.adAccountIds, id) }))}
          empty="No Meta ad accounts synced yet."
        />
        <AssetPicker
          label="Google Ads accounts (optional)"
          description="Search / YouTube / Display. Multiple accounts allowed."
          items={googleAdItems}
          selectedIds={form.googleAdAccountIds}
          onToggle={(id) =>
            setForm((current) => ({
              ...current,
              googleAdAccountIds: toggleId(current.googleAdAccountIds, id),
            }))
          }
          empty="No Google Ads accounts connected yet."
        />
      </div>
    </>
  );

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Client Management</h1>
          <p className="text-muted-foreground mt-1">Manage your agency clients and approval portals.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setIsFromTemplate(true);
              setIsAdding(false);
              setEditingClient(null);
            }}
            className="border-border flex items-center gap-2 rounded-md border bg-surface px-4 py-2 text-sm font-medium transition hover:bg-surface-muted"
          >
            <LayoutTemplate className="size-4" /> Create from template
          </button>
          <button
            onClick={openAdd}
            className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition"
          >
            <Plus className="size-4" /> Add Client
          </button>
        </div>
      </div>

      {isFromTemplate && (
        <div className="bg-surface-muted rounded-xl border p-6">
          <h3 className="text-lg font-medium mb-4">Create client from template</h3>
          {(templates?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">
              No templates yet. Use &quot;Save as template&quot; on an existing client first.
            </p>
          ) : (
            <form onSubmit={handleCreateFromTemplate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Template</label>
                  <select
                    required
                    value={templateForm.templateId}
                    onChange={(e) => setTemplateForm({ ...templateForm, templateId: e.target.value })}
                    className="bg-surface border-border flex h-10 w-full rounded-md border px-3 py-2 text-sm"
                  >
                    <option value="">-- Select template --</option>
                    {templates?.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">New client name</label>
                  <input
                    type="text"
                    required
                    value={templateForm.name}
                    onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                    className="bg-surface border-border flex h-10 w-full rounded-md border px-3 py-2 text-sm"
                    placeholder="e.g. Acme Co"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Approver Name</label>
                  <input
                    type="text"
                    required
                    value={templateForm.approverName}
                    onChange={(e) => setTemplateForm({ ...templateForm, approverName: e.target.value })}
                    className="bg-surface border-border flex h-10 w-full rounded-md border px-3 py-2 text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Approver Email</label>
                  <input
                    type="email"
                    required
                    value={templateForm.approverEmail}
                    onChange={(e) => setTemplateForm({ ...templateForm, approverEmail: e.target.value })}
                    className="bg-surface border-border flex h-10 w-full rounded-md border px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsFromTemplate(false)}
                  className="text-muted-foreground hover:text-foreground text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium transition"
                >
                  Create from template
                </button>
              </div>
            </form>
          )}
          {(templates?.length ?? 0) === 0 ? (
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setIsFromTemplate(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-medium"
              >
                Close
              </button>
            </div>
          ) : null}
        </div>
      )}

      {isAdding && (
        <div className="bg-surface-muted rounded-xl border p-6">
          <h3 className="text-lg font-medium mb-4">Add New Client</h3>
          <form onSubmit={handleAddClient} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Agency Client Name</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="bg-surface border-border flex h-10 w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="e.g. Podosphere Technologies"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Approver Name</label>
                <input
                  type="text"
                  required
                  value={form.approverName}
                  onChange={(e) => setForm({ ...form, approverName: e.target.value })}
                  className="bg-surface border-border flex h-10 w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="e.g. Sushant"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Approver Email</label>
                <input
                  type="email"
                  required
                  value={form.approverEmail}
                  onChange={(e) => setForm({ ...form, approverEmail: e.target.value })}
                  className="bg-surface border-border flex h-10 w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="e.g. sushant@example.com"
                />
              </div>
              {linkPickers}
            </div>
            {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={closeForms}
                className="text-muted-foreground hover:text-foreground text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium transition disabled:opacity-60"
              >
                {saving ? 'Creating…' : 'Create Client'}
              </button>
            </div>
          </form>
        </div>
      )}

      {editingClient && (
        <div className="bg-surface-muted rounded-xl border p-6">
          <h3 className="text-lg font-medium mb-1">Link channels &amp; ad accounts</h3>
          <p className="text-muted-foreground mb-4 text-sm">{editingClient.name}</p>
          <form onSubmit={handleUpdateLinks} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">{linkPickers}</div>
            {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={closeForms}
                className="text-muted-foreground hover:text-foreground text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium transition disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save links'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-surface rounded-xl border overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-muted/50 border-b text-xs uppercase">
            <tr>
              <th className="px-6 py-4 font-medium text-muted-foreground">Client Name</th>
              <th className="px-6 py-4 font-medium text-muted-foreground">Approver</th>
              <th className="px-6 py-4 font-medium text-muted-foreground">Linked Ads</th>
              <th className="px-6 py-4 font-medium text-muted-foreground">Linked Channels</th>
              <th className="px-6 py-4 font-medium text-muted-foreground text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {!clients ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-muted-foreground">
                  Loading...
                </td>
              </tr>
            ) : clients.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-muted-foreground">
                  No clients added yet.
                </td>
              </tr>
            ) : (
              clients.map((client) => (
                <tr key={client.id} className="hover:bg-surface-muted/30 transition">
                  <td className="px-6 py-4 font-medium">
                    <div>{client.name}</div>
                    {client.onboardingStep && client.onboardingStep !== 'done' ? (
                      <span className="text-muted-foreground text-xs">
                        Onboarding: {client.onboardingStep.replaceAll('_', ' ')}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-6 py-4">
                    {client.approvers?.[0]?.name} <br />
                    <span className="text-muted-foreground text-xs">{client.approvers?.[0]?.email}</span>
                  </td>
                  <td className="px-6 py-4">
                    <ChipList
                      items={[
                        ...(client.adAccounts ?? []).map((account) => ({
                          id: account.id,
                          label: `Meta · ${account.name}`,
                        })),
                        ...(client.googleAdsAccounts ?? []).map((account) => ({
                          id: account.id,
                          label: `Google · ${account.name}`,
                        })),
                      ]}
                    />
                  </td>
                  <td className="px-6 py-4">
                    <ChipList
                      items={(client.integrations ?? []).map((channel) => ({
                        id: channel.id,
                        label: channel.name,
                      }))}
                    />
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="inline-flex flex-wrap items-center justify-end gap-2">
                      <button
                        onClick={() => openEdit(client)}
                        className="inline-flex items-center gap-1.5 rounded-md border bg-surface px-3 py-1.5 text-xs font-medium shadow-sm hover:bg-surface-muted transition"
                      >
                        <Pencil className="size-3.5" /> Edit links
                      </button>
                      <Link
                        href={`/dashboard/social/clients/${client.id}/onboarding`}
                        className="inline-flex items-center gap-1.5 rounded-md border bg-surface px-3 py-1.5 text-xs font-medium shadow-sm hover:bg-surface-muted transition"
                      >
                        <Wand2 className="size-3.5" /> Onboard
                      </Link>
                      <button
                        onClick={() => saveAsTemplate(client)}
                        disabled={savingTemplateId === client.id}
                        className="inline-flex items-center gap-1.5 rounded-md border bg-surface px-3 py-1.5 text-xs font-medium shadow-sm hover:bg-surface-muted transition disabled:opacity-60"
                      >
                        {savedTemplateId === client.id ? (
                          <>
                            <Check className="size-3.5 text-green-500" /> Saved
                          </>
                        ) : (
                          <>
                            <BookmarkPlus className="size-3.5" />
                            {savingTemplateId === client.id ? 'Saving…' : 'Save as template'}
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => generateLink(client.id)}
                        className="inline-flex items-center gap-1.5 rounded-md border bg-surface px-3 py-1.5 text-xs font-medium shadow-sm hover:bg-surface-muted transition"
                      >
                        {copiedId === client.id ? (
                          <>
                            <Check className="size-3.5 text-green-500" /> Copied!
                          </>
                        ) : (
                          <>
                            <LinkIcon className="size-3.5" /> Copy Magic Link
                          </>
                        )}
                      </button>
                      {client.approvers?.[0] ? (
                        <button
                          onClick={() => revokeLink(client.id, client.approvers[0].id)}
                          disabled={revokingId === client.id}
                          className="inline-flex items-center gap-1.5 rounded-md border border-red-500/30 bg-surface px-3 py-1.5 text-xs font-medium text-red-600 shadow-sm transition hover:bg-red-500/10 disabled:opacity-60"
                        >
                          {revokedId === client.id ? (
                            <>
                              <Check className="size-3.5" /> Revoked
                            </>
                          ) : (
                            <>
                              <Ban className="size-3.5" />{' '}
                              {revokingId === client.id ? 'Revoking…' : 'Revoke link'}
                            </>
                          )}
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
