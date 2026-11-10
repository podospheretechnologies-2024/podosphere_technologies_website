'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { apiFetch } from '@/shared/lib/fetcher';
import { errorText, GROWTH_API, growthCall, useGrowth, type ContentSheet, type ContentSheetOption } from './growth-api';
import { Empty, ErrorLine, Field, Panel, Pill, selectClass } from './growth-ui';

/** "Google Sheets connected" note left by the Google redirect (?googleSheets=connected), read once after mount. */
function useSheetsRedirectNote(): string | null {
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('googleSheets') !== 'connected') return;
    setNote("Google Sheets connected. Pick this client's content calendar below.");
    ['googleSheets', 'tab'].forEach((key) => params.delete(key));
    const query = params.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
  }, []);
  return note;
}

const day = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

/** Setup tab: the agency Google login (shared with Plugs → Google Sheets) + this client's calendar sheet. */
export function ContentSheetPanel({ canReview }: { canReview: boolean }) {
  const { data: status, mutate } = useGrowth<ContentSheet>('/content-sheet');
  const { data: options, mutate: mutateOptions } = useGrowth<{ sheets: ContentSheetOption[] }>(
    canReview && status?.connected ? '/content-sheet/options' : null
  );
  const [pick, setPick] = useState('');
  const [paste, setPaste] = useState('');
  const [tab, setTab] = useState('');
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const redirectNote = useSheetsRedirectNote();

  const sheets = useMemo(() => options?.sheets ?? [], [options]);
  const picked = sheets.find((s) => s.spreadsheetId === pick);
  const tabs = picked?.sheetNames ?? (pick && pick === status?.link?.spreadsheetId ? (status.sheet?.tabs ?? []) : []);
  const showPicker = canReview && (editing || !status?.link);

  function startEdit() {
    setPick(status?.link?.spreadsheetId ?? '');
    setPaste('');
    setTab(status?.link?.tab ?? '');
    setEditing(true);
  }

  async function connect() {
    setBusy('connect');
    setError(null);
    try {
      const { url } = await apiFetch<{ url: string }>('/api/social/google-sheets/connect?returnTo=growth');
      window.location.assign(url);
    } catch (e) {
      setError(errorText(e));
      setBusy(null);
    }
  }

  async function save(link: string | null, nextTab: string | null) {
    setBusy(link ? 'save' : 'remove');
    setError(null);
    try {
      const next = await growthCall<ContentSheet>('/content-sheet', 'PUT', { link, tab: nextTab });
      await mutate(next, { revalidate: false });
      setEditing(false);
      setPick('');
      setPaste('');
      setTab('');
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  }

  async function refreshList() {
    setBusy('list');
    setError(null);
    try {
      await apiFetch('/api/social/google-sheets/refresh', { method: 'POST' });
      await mutateOptions();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  }

  const link = status?.link;
  return (
    <Panel title="Content calendar (Google Sheets)">
      <p className="text-muted-foreground text-xs">
        The client&apos;s content calendar sheet: what is planned for each day. It shows on the Content tab next to the Calendar, and the post
        composer fills captions only from <b>this client&apos;s</b> sheet. Read-only; nothing is written back to the sheet. Needs a
        <b> Date</b> column and a <b>Caption/Content</b> column; Platform, Format and Status columns are shown when present.
      </p>
      {redirectNote && <p className="text-sm">{redirectNote}</p>}
      {!status && <p className="text-muted-foreground text-sm">Loading…</p>}

      {status && !status.configured && (
        <p className="text-sm text-amber-700 dark:text-amber-400">
          Google is not set up on the server: add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env.
        </p>
      )}

      {status?.configured && !status.connected && (
        <div className="flex flex-col gap-2">
          {status.canConnect ? (
            <Button disabled={Boolean(busy)} onClick={connect}>
              {busy === 'connect' ? 'Opening Google…' : 'Connect Google Sheets'}
            </Button>
          ) : (
            <p className="text-muted-foreground text-sm">Ask an owner or admin to connect Google Sheets.</p>
          )}
          <p className="text-muted-foreground text-xs">
            One Google login for the whole agency (also used in Plugs). Each client&apos;s sheet must be shared with that Google account.
          </p>
        </div>
      )}

      {status?.connected && (
        <p className="text-muted-foreground text-xs">
          Google login: <b>{status.googleEmail}</b>
        </p>
      )}

      {link && !editing && (
        <div className="flex flex-col gap-2 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <strong className="break-words">{status?.sheet?.name ?? 'Linked sheet'}</strong>
            <Pill tone={status?.error ? 'bad' : status?.sheet ? 'good' : 'muted'}>
              {status?.error ? 'Error' : status?.sheet ? 'Linked' : 'Waiting for Google login'}
            </Pill>
            <span className="text-muted-foreground text-xs">{link.tab ? `tab "${link.tab}"` : 'all tabs'}</span>
          </div>
          {status?.sheet && (
            <p className="text-muted-foreground text-xs">Read {new Date(status.sheet.syncedAt).toLocaleString('en-IN')} · refreshes every 15 minutes when opened</p>
          )}
          <div className="flex flex-wrap gap-2">
            <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-primary text-sm underline">
              Open sheet
            </a>
            {canReview && (
              <>
                <Button size="sm" variant="secondary" disabled={Boolean(busy)} onClick={startEdit}>
                  Change
                </Button>
                <Button
                  size="sm"
                  variant="danger-ghost"
                  disabled={Boolean(busy)}
                  onClick={() => {
                    if (window.confirm('Unlink this sheet from the client? Nothing changes in Google.')) void save(null, null);
                  }}
                >
                  Unlink
                </Button>
              </>
            )}
          </div>
        </div>
      )}
      {status?.error && <p className="text-danger text-xs">{status.error}</p>}

      {status && showPicker && (
        <div className="flex flex-col gap-2">
          {status.connected && (
            <Field label="Sheet for this client">
              <select
                className={selectClass}
                value={pick}
                onChange={(e) => {
                  setPick(e.target.value);
                  setPaste('');
                  setTab('');
                }}
              >
                <option value="">{sheets.length ? 'Choose a sheet…' : 'No sheets found yet'}</option>
                {sheets.map((s) => (
                  <option key={s.spreadsheetId} value={s.spreadsheetId}>
                    {s.name} ({s.rowCount} rows)
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field label={status.connected ? 'or paste the sheet link' : 'Sheet link (read once Google Sheets is connected)'}>
            <Input
              value={paste}
              onChange={(e) => {
                setPaste(e.target.value);
                if (e.target.value) setPick('');
              }}
              placeholder="https://docs.google.com/spreadsheets/d/…"
            />
          </Field>
          {tabs.length > 1 && (
            <Field label="Tab (for one master sheet with a tab per client)">
              <select className={selectClass} value={tab} onChange={(e) => setTab(e.target.value)}>
                <option value="">All tabs</option>
                {tabs.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={Boolean(busy) || (!pick && !paste.trim())}
              onClick={() => void save(paste.trim() || (picked ? picked.url : pick), tab || null)}
            >
              {busy === 'save' ? 'Checking the sheet…' : 'Use this sheet'}
            </Button>
            {status.connected && status.canConnect && (
              <Button size="sm" variant="secondary" disabled={Boolean(busy)} onClick={refreshList}>
                {busy === 'list' ? 'Reading Google Drive…' : 'Refresh list'}
              </Button>
            )}
            {editing && (
              <Button size="sm" variant="secondary" disabled={Boolean(busy)} onClick={() => setEditing(false)}>
                Cancel
              </Button>
            )}
          </div>
          {status.connected && (
            <p className="text-muted-foreground text-xs">
              Sheet not in the list? Share it with <b>{status.googleEmail}</b> (Viewer is enough), then paste its link
              {status.canConnect ? ' or press Refresh list' : ''}.
            </p>
          )}
        </div>
      )}
      {status && !link && !canReview && <Empty>No content calendar sheet linked for this client yet.</Empty>}
      <ErrorLine error={error} />
    </Panel>
  );
}

/** Content tab: what the client's sheet plans for the last 2 weeks and next 60 days, against the Calendar. */
export function ContentSheetSection() {
  const { data, error, mutate } = useGrowth<ContentSheet>('/content-sheet');
  const [busy, setBusy] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

  async function refresh() {
    setBusy(true);
    setRefreshError(null);
    try {
      const next = await apiFetch<ContentSheet>(`${GROWTH_API}/content-sheet?refresh=1`);
      await mutate(next, { revalidate: false });
    } catch (e) {
      setRefreshError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  const rows = data?.rows ?? [];
  const upcoming = rows.filter((r) => r.date >= today);
  const missing = upcoming.filter((r) => !r.inCalendar);

  return (
    <Panel
      title="Content calendar sheet"
      action={
        data?.link && (
          <div className="flex items-center gap-3 text-sm">
            <a href={data.sheet?.url ?? data.link.url} target="_blank" rel="noopener noreferrer" className="text-primary underline">
              Open sheet
            </a>
            {data.sheet && (
              <Button size="sm" variant="secondary" disabled={busy} onClick={refresh}>
                {busy ? 'Reading…' : 'Refresh'}
              </Button>
            )}
          </div>
        )
      }
    >
      {!data && !error && <p className="text-muted-foreground text-sm">Loading…</p>}
      <ErrorLine error={error?.message ?? refreshError ?? data?.error ?? null} />
      {data && !data.link && <Empty>No content calendar sheet linked for this client. Link it in Setup → Content calendar.</Empty>}
      {data?.link && !data.connected && <Empty>Google Sheets is not connected yet. An owner or admin connects it in Setup.</Empty>}

      {data?.sheet && (
        <>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="bg-surface-muted rounded-lg px-3 py-2">
              <b className="block text-lg tabular-nums">{upcoming.length}</b>
              planned in the next 60 days
            </span>
            <span className="bg-surface-muted rounded-lg px-3 py-2">
              <b className="block text-lg tabular-nums">{missing.length}</b>
              not in the Calendar yet
            </span>
            {data.undated > 0 && (
              <span className="bg-surface-muted rounded-lg px-3 py-2">
                <b className="block text-lg tabular-nums">{data.undated}</b>
                rows without a readable date
              </span>
            )}
          </div>
          {!rows.length && <Empty>No dated rows between {day(data.from)} and {day(data.to)}.</Empty>}
          {rows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-muted-foreground">
                  <tr className="border-border border-b">
                    {['Date', 'Planned content', 'Platform', 'Format', 'Sheet status', 'Calendar'].map((h) => (
                      <th key={h} className="px-2 py-1.5 text-left font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={`${r.sheetName}-${r.rowIndex}`} className={`border-border border-b ${r.date < today ? 'opacity-60' : ''}`}>
                      <td className="px-2 py-1.5 whitespace-nowrap">{day(r.date)}</td>
                      <td className="max-w-96 px-2 py-1.5">
                        <p className="line-clamp-3 break-words whitespace-pre-wrap" title={r.content}>
                          {r.content || '–'}
                        </p>
                      </td>
                      <td className="px-2 py-1.5">{r.platform ?? '–'}</td>
                      <td className="px-2 py-1.5">{r.format ?? '–'}</td>
                      <td className="px-2 py-1.5">{r.status ?? '–'}</td>
                      <td className="px-2 py-1.5">
                        {r.inCalendar ? (
                          <Pill tone="good">In Calendar</Pill>
                        ) : r.date >= today ? (
                          <Pill tone="warn">Not scheduled</Pill>
                        ) : (
                          <Pill tone="muted">No post</Pill>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </Panel>
  );
}
