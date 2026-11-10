'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import useSWR, { mutate as globalMutate } from 'swr';
import { ArrowLeft, Loader2, Search } from 'lucide-react';
import { apiFetch, ApiError } from '@/shared/lib/fetcher';
import { CLIENT_SCOPE_API_ROUTE } from '@/modules/social/hooks/use-client-scope';

type Kind = 'channel' | 'meta_ad' | 'google_ad';

interface Asset {
  kind: Kind;
  id: string;
  name: string;
  username?: string | null;
  provider?: string | null;
}

interface Group {
  key: string;
  suggestedName: string;
  clientId: string | null;
  assets: Asset[];
}

interface SortData {
  clients: { id: string; name: string }[];
  groups: Group[];
  clientLimit: number;
  planLabel: string;
}

/** Per-group choice on screen. `target` is a client id, NEW, or SKIP. */
interface Choice {
  target: string;
  newName: string;
  excluded: Set<string>;
}

const NEW = '__new__';
const SKIP = '__skip__';

const KIND_LABEL: Record<Kind, string> = {
  channel: 'Channel',
  meta_ad: 'Meta ad account',
  google_ad: 'Google Ads account',
};

function assetKey(asset: Asset) {
  return `${asset.kind}:${asset.id}`;
}

export default function SortChannelsPage() {
  const { data, error, isLoading, mutate } = useSWR<SortData>('/api/social/clients/sort', (url: string) => apiFetch<SortData>(url));
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  // Default every group to its suggestion: matched client, else a new client with the suggested name.
  // Only groups without a choice yet get one, so edits survive a refresh of the data.
  useEffect(() => {
    if (!data) return;
    setChoices((current) => {
      const next = { ...current };
      for (const group of data.groups) {
        if (next[group.key]) continue;
        next[group.key] = { target: group.clientId ?? NEW, newName: group.suggestedName, excluded: new Set() };
      }
      return next;
    });
  }, [data]);

  const visibleGroups = useMemo(() => {
    const groups = data?.groups ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter(
      (g) => g.suggestedName.toLowerCase().includes(q) || g.assets.some((a) => a.name.toLowerCase().includes(q))
    );
  }, [data, query]);

  const plan = useMemo(() => {
    const groups = data?.groups ?? [];
    let items = 0;
    const newNames = new Set<string>();
    for (const group of groups) {
      const choice = choices[group.key];
      if (!choice || choice.target === SKIP) continue;
      const count = group.assets.filter((a) => !choice.excluded.has(assetKey(a))).length;
      if (count === 0) continue;
      items += count;
      if (choice.target === NEW && choice.newName.trim()) newNames.add(choice.newName.trim().toLowerCase());
    }
    return { items, newClients: newNames.size };
  }, [data, choices]);

  function update(key: string, patch: Partial<Choice>) {
    setChoices((current) => ({ ...current, [key]: { ...current[key], ...patch } }));
  }

  function toggleAsset(groupKey: string, asset: Asset) {
    const choice = choices[groupKey];
    if (!choice) return;
    const excluded = new Set(choice.excluded);
    const k = assetKey(asset);
    if (excluded.has(k)) excluded.delete(k);
    else excluded.add(k);
    update(groupKey, { excluded });
  }

  function skipAll() {
    setChoices((current) => Object.fromEntries(Object.entries(current).map(([k, c]) => [k, { ...c, target: SKIP }])));
  }

  async function apply() {
    if (!data) return;
    const groups = data.groups.flatMap((group) => {
      const choice = choices[group.key];
      if (!choice || choice.target === SKIP) return [];
      const assets = group.assets.filter((a) => !choice.excluded.has(assetKey(a)));
      if (assets.length === 0) return [];
      const ids = (kind: Kind) => assets.filter((a) => a.kind === kind).map((a) => a.id);
      const target =
        choice.target === NEW ? { newClientName: choice.newName.trim() } : { clientId: choice.target };
      if (choice.target === NEW && !choice.newName.trim()) return [];
      return [
        {
          ...target,
          integrationIds: ids('channel'),
          adAccountIds: ids('meta_ad'),
          googleAdAccountIds: ids('google_ad'),
        },
      ];
    });
    if (groups.length === 0) return;

    setBusy(true);
    setMessage(null);
    try {
      const result = await apiFetch<{ created: number; moved: number }>('/api/social/clients/sort', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groups }),
      });
      setChoices({});
      await Promise.all([mutate(), globalMutate(CLIENT_SCOPE_API_ROUTE)]);
      setMessage({
        tone: 'ok',
        text: `Done: ${result.moved} items assigned${result.created ? `, ${result.created} new clients created` : ''}. New clients have no approver yet; add one on the Clients page.`,
      });
    } catch (err) {
      setMessage({ tone: 'error', text: err instanceof ApiError ? err.message : 'Could not save. Try again.' });
    } finally {
      setBusy(false);
    }
  }

  const clients = data?.clients ?? [];

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-6">
      <div>
        <Link href="/dashboard/social/clients" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm">
          <ArrowLeft className="size-4" /> Clients
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Sort channels into clients</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Every channel and ad account that is not on a client yet, grouped by brand name. Check each group, change the client if the
          guess is wrong, untick anything that does not belong, then assign. Once a channel is on a client, picking that client in the
          top bar shows only its data, and team members see only the clients you give them on the Team page.
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error instanceof ApiError ? error.message : 'Could not load channels.'}</p>}
      {isLoading && (
        <p className="text-muted-foreground flex items-center gap-2 text-sm">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </p>
      )}

      {message && (
        <p
          className={`rounded-lg border p-3 text-sm ${message.tone === 'ok' ? 'border-green-200 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-300' : 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300'}`}
        >
          {message.text}
        </p>
      )}

      {data && data.groups.length === 0 && (
        <div className="bg-surface border-border rounded-xl border p-6 text-sm">
          Everything is already on a client. New channels you connect will show up here.
        </div>
      )}

      {data && data.groups.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[220px] flex-1">
              <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search a brand or channel"
                className="border-border bg-surface h-9 w-full rounded-md border pr-3 pl-9 text-sm outline-none"
              />
            </div>
            <span className="text-muted-foreground text-sm">
              {data.groups.reduce((n, g) => n + g.assets.length, 0)} unassigned in {data.groups.length} groups · {clients.length} of{' '}
              {data.clientLimit} clients used ({data.planLabel})
            </span>
            <button type="button" onClick={skipAll} className="text-muted-foreground hover:text-foreground text-sm underline">
              Skip all
            </button>
          </div>

          <div className="space-y-3">
            {visibleGroups.map((group) => {
              const choice = choices[group.key];
              if (!choice) return null;
              const skipped = choice.target === SKIP;
              return (
                <div key={group.key} className={`bg-surface border-border rounded-xl border p-4 ${skipped ? 'opacity-60' : ''}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      aria-label={`Client for ${group.suggestedName}`}
                      value={choice.target}
                      onChange={(e) => update(group.key, { target: e.target.value })}
                      className="border-border bg-surface h-9 rounded-md border px-2 text-sm"
                    >
                      <option value={NEW}>New client…</option>
                      {clients.length > 0 && (
                        <optgroup label="Existing clients">
                          {clients.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      <option value={SKIP}>Skip for now</option>
                    </select>
                    {choice.target === NEW && (
                      <input
                        aria-label="New client name"
                        value={choice.newName}
                        onChange={(e) => update(group.key, { newName: e.target.value })}
                        className="border-border bg-surface h-9 min-w-[200px] flex-1 rounded-md border px-3 text-sm"
                      />
                    )}
                    {group.clientId && choice.target === group.clientId && (
                      <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700 dark:bg-green-950 dark:text-green-300">
                        matches existing client
                      </span>
                    )}
                  </div>
                  {!skipped && (
                    <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
                      {group.assets.map((asset) => (
                        <li key={assetKey(asset)}>
                          <label className="flex cursor-pointer items-start gap-2 text-sm">
                            <input
                              type="checkbox"
                              className="mt-0.5"
                              checked={!choice.excluded.has(assetKey(asset))}
                              onChange={() => toggleAsset(group.key, asset)}
                            />
                            <span>
                              <span className="font-medium">{asset.name}</span>
                              <span className="text-muted-foreground block text-xs">
                                {asset.provider ?? KIND_LABEL[asset.kind]}
                                {asset.username && asset.username !== asset.name ? ` · @${asset.username}` : ''}
                                {asset.kind !== 'channel' ? ` · ${asset.id}` : ''}
                              </span>
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>

          <div className="bg-surface border-border sticky bottom-4 z-20 rounded-xl border px-4 py-3 shadow-lg">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm">
                Assign <b>{plan.items}</b> items{plan.newClients > 0 ? ` · creates ${plan.newClients} new clients` : ''}
                {clients.length + plan.newClients > data.clientLimit && (
                  <span className="ml-2 text-red-600">over the {data.clientLimit}-client limit of your plan</span>
                )}
              </span>
              <button
                type="button"
                disabled={busy || plan.items === 0}
                onClick={() => void apply()}
                className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-9 items-center gap-2 rounded-md px-4 text-sm font-medium disabled:opacity-60"
              >
                {busy && <Loader2 className="size-4 animate-spin" />}
                Assign
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
