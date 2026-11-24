'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Modal } from '@/shared/components/ui/modal';
import { apiFetch } from '@/shared/lib/fetcher';
import { useClientScope } from '../../hooks/use-client-scope';
import type { PendingPagesResponse } from '../../types/integration';
import { ChannelAvatar } from './channel-avatar';

const PENDING_PAGES_API = '/api/social/integrations/pending-pages';
const UNASSIGNED = '';

/**
 * PS-01: after Meta OAuth with several Pages, the admin ticks the Pages that belong here.
 * Pages not ticked are never saved. New Pages go to the picked client, or stay Unassigned (R5).
 */
export function PendingPagesPicker({
  onDone,
}: {
  onDone: (result: { connected: string[] } | { error: string } | null) => void;
}) {
  const { clients } = useClientScope();
  const [data, setData] = useState<PendingPagesResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [clientId, setClientId] = useState<string>(UNASSIGNED);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch<PendingPagesResponse>(PENDING_PAGES_API)
      .then((pending) => {
        if (cancelled) return;
        setData(pending);
        // Pre-tick only the Pages already connected here, so a reconnect renews their tokens.
        setSelected(new Set(pending.pages.filter((page) => page.connected).map((page) => page.internalId)));
        setClientId(pending.client?.id ?? UNASSIGNED);
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : 'Could not load the Pages');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const pages = useMemo(() => data?.pages ?? [], [data]);

  function toggle(internalId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(internalId)) next.delete(internalId);
      else next.add(internalId);
      return next;
    });
  }

  async function save() {
    setSaving(true);
    setSaveError(null);
    try {
      const result = await apiFetch<{ connected: { id: string; name: string }[] }>(PENDING_PAGES_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ internalIds: [...selected], customerId: clientId || null }),
      });
      onDone({ connected: result.connected.map((row) => row.name) });
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not save the Pages');
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      size="lg"
      title="Pick the Pages to connect"
      description="Meta returned every Page this login manages. Tick only the ones that belong in this workspace. Pages you leave unticked are not saved."
      onClose={() => onDone(null)}
    >
      {loadError ? (
        <div className="space-y-3">
          <p className="text-danger text-sm">{loadError}</p>
          <Button variant="secondary" onClick={() => onDone({ error: loadError })}>
            Close
          </Button>
        </div>
      ) : !data ? (
        <p className="text-muted-foreground text-sm">Loading Pages…</p>
      ) : (
        <div className="space-y-4">
          <label className="block space-y-1 text-sm">
            <span className="text-muted-foreground text-xs font-medium">New Pages go to</span>
            <select
              className="border-border bg-background w-full rounded-lg border px-3 py-2 text-sm"
              value={clientId}
              onChange={(event) => setClientId(event.target.value)}
            >
              <option value={UNASSIGNED}>Unassigned (admins only, map later)</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
            <span className="text-muted-foreground block text-xs">
              Pages already on a client keep that client. Move them from the client&apos;s page.
            </span>
          </label>

          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              {selected.size} of {pages.length} selected
            </span>
            <div className="flex gap-3">
              <button
                type="button"
                className="text-primary font-medium"
                onClick={() => setSelected(new Set(pages.map((page) => page.internalId)))}
              >
                Select all
              </button>
              <button type="button" className="text-primary font-medium" onClick={() => setSelected(new Set())}>
                Clear
              </button>
            </div>
          </div>

          <ul className="border-border max-h-[50vh] divide-y overflow-y-auto rounded-xl border">
            {pages.map((page) => (
              <li key={page.internalId}>
                <label className="hover:bg-surface-muted flex cursor-pointer items-center gap-3 px-4 py-2.5">
                  <input
                    type="checkbox"
                    checked={selected.has(page.internalId)}
                    onChange={() => toggle(page.internalId)}
                  />
                  <ChannelAvatar name={page.name} picture={page.picture} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{page.name}</span>
                    {page.username ? (
                      <span className="text-muted-foreground block truncate text-xs">@{page.username}</span>
                    ) : null}
                  </span>
                  <span className="text-muted-foreground shrink-0 text-xs">
                    {page.client ? `On ${page.client.name}` : page.connected ? 'Unassigned' : 'New'}
                  </span>
                </label>
              </li>
            ))}
          </ul>

          {saveError ? <p className="text-danger text-sm">{saveError}</p> : null}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => onDone(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => void save()} disabled={saving || selected.size === 0}>
              {saving ? 'Saving…' : `Connect ${selected.size} ${selected.size === 1 ? 'Page' : 'Pages'}`}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
