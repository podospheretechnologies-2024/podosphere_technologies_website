'use client';

import { ExternalLink, RefreshCw, Sheet } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { useGoogleSheets } from '../../hooks/use-automation';
import {
  disconnectGoogleSheets,
  refreshGoogleSheets,
  startGoogleSheetsConnect,
} from '../../lib/google-sheets.client';
import type { GoogleSpreadsheetItem } from '../../types/google-sheets';

function formatWhen(iso: string | null | undefined) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function GoogleMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function SpreadsheetPreview({ sheet }: { sheet: GoogleSpreadsheetItem }) {
  const previewRows = sheet.rows.slice(0, 3);
  return (
    <li className="border-border/80 hover:border-border rounded-xl border bg-white p-3.5 shadow-sm transition">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#E6F4EA] text-[#137333]">
            <Sheet className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[#1C1E21]">{sheet.name}</p>
            <p className="text-muted-foreground mt-0.5 text-xs">
              {sheet.rowCount} row{sheet.rowCount === 1 ? '' : 's'}
              {sheet.sheetNames.length > 0 ? ` · ${sheet.sheetNames.slice(0, 3).join(', ')}` : ''}
            </p>
          </div>
        </div>
        <a
          href={sheet.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:bg-surface-muted hover:text-foreground inline-flex size-8 shrink-0 items-center justify-center rounded-lg"
          title="Open in Google Sheets"
          aria-label={`Open ${sheet.name} in Google Sheets`}
        >
          <ExternalLink className="size-3.5" />
        </a>
      </div>
      {previewRows.length > 0 && (
        <ul className="mt-3 space-y-1.5 border-t border-[#F0F2F5] pt-3">
          {previewRows.map((row) => (
            <li
              key={`${row.sheetName}-${row.rowIndex}`}
              className="line-clamp-2 rounded-lg bg-[#F8F9FA] px-2.5 py-1.5 text-xs leading-relaxed text-[#5F6368]"
            >
              {row.dateValue ? (
                <span className="font-semibold text-[#1C1E21]">{row.dateValue}: </span>
              ) : null}
              {row.content || 'Empty row'}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export function GoogleSheetsCard() {
  const { data, error, mutate } = useGoogleSheets(true);
  const [busy, setBusy] = useState<'connect' | 'refresh' | 'disconnect' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const spreadsheets = data?.spreadsheets ?? [];
  const visible = useMemo(
    () => (expanded ? spreadsheets : spreadsheets.slice(0, 4)),
    [expanded, spreadsheets]
  );

  async function run(kind: 'connect' | 'refresh' | 'disconnect', action: () => Promise<void>) {
    setActionError(null);
    setNotice(null);
    setBusy(kind);
    try {
      await action();
    } catch (failure) {
      setActionError(failure instanceof Error ? failure.message : 'Something went wrong');
    } finally {
      setBusy(null);
    }
  }

  function connect() {
    return run('connect', async () => {
      await startGoogleSheetsConnect();
    });
  }

  function refresh() {
    return run('refresh', async () => {
      const next = await refreshGoogleSheets();
      await mutate(next, { revalidate: false });
      setNotice(
        `Synced ${next.connection.spreadsheetCount} spreadsheet${next.connection.spreadsheetCount === 1 ? '' : 's'} (${next.connection.rowCount} rows).`
      );
    });
  }

  function disconnect() {
    if (!window.confirm('Disconnect Google Sheets? Cached sheet data will be removed.')) {
      return;
    }
    return run('disconnect', async () => {
      await disconnectGoogleSheets();
      await mutate();
      setNotice('Google Sheets disconnected.');
    });
  }

  const connected = Boolean(data?.connection.connected);
  const configured = data?.connection.configured ?? true;

  return (
    <Card className="space-y-4 overflow-hidden">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#E6F4EA] shadow-sm">
            <Sheet className="size-5 text-[#137333]" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold tracking-tight text-[#1C1E21]">Google Sheets</h2>
            <p className="text-muted-foreground mt-0.5 text-sm leading-relaxed">
              Sync historical and new spreadsheets from your Google account. Refresh anytime for the
              latest rows.
            </p>
          </div>
        </div>

        {connected ? (
          <Button
            size="sm"
            variant="secondary"
            onClick={refresh}
            disabled={busy !== null}
            className="shrink-0 self-start whitespace-nowrap"
          >
            <RefreshCw className={`size-3.5 ${busy === 'refresh' ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        ) : (
          <button
            type="button"
            onClick={connect}
            disabled={busy !== null || configured === false}
            className="inline-flex h-9 shrink-0 items-center justify-center gap-2 self-start rounded-lg border border-[#DADCE0] bg-white px-3.5 text-sm font-medium whitespace-nowrap text-[#3C4043] shadow-sm transition hover:bg-[#F8F9FA] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <GoogleMark className="size-4 shrink-0" />
            {busy === 'connect' ? 'Opening…' : 'Connect Google Account'}
          </button>
        )}
      </div>

      {configured === false && (
        <p className="text-muted-foreground rounded-xl border border-dashed border-[#DADCE0] bg-[#F8F9FA] px-3 py-2.5 text-sm">
          Set <code className="rounded bg-white px-1.5 py-0.5 text-xs">GOOGLE_CLIENT_ID</code> and{' '}
          <code className="rounded bg-white px-1.5 py-0.5 text-xs">GOOGLE_CLIENT_SECRET</code> in{' '}
          <code className="rounded bg-white px-1.5 py-0.5 text-xs">.env</code>, then restart the
          server.
        </p>
      )}

      {notice && (
        <div
          role="status"
          className="border-success/40 bg-success/10 text-success rounded-xl border px-3 py-2.5 text-sm"
        >
          {notice}
        </div>
      )}
      {actionError && (
        <div
          role="alert"
          className="border-danger/40 bg-danger/10 text-danger rounded-xl border px-3 py-2.5 text-sm"
        >
          {actionError}
        </div>
      )}
      {error && !data && (
        <p className="text-danger text-sm">
          {error instanceof Error ? error.message : 'Could not load Google Sheets'}
        </p>
      )}

      {!data && !error ? (
        <p className="text-muted-foreground text-sm">Loading Google Sheets…</p>
      ) : !connected ? (
        <div className="rounded-2xl border border-[#E8EAED] bg-gradient-to-b from-[#F8F9FA] to-white px-5 py-6 text-center">
          <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-[#E8EAED]">
            <GoogleMark className="size-6" />
          </div>
          <p className="text-sm font-semibold text-[#1C1E21]">No Google account connected</p>
          <p className="text-muted-foreground mx-auto mt-1 max-w-xs text-sm leading-relaxed">
            Sign in once to pull every spreadsheet you can access, then keep it updated with
            Refresh.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E8EAED] bg-[#F8F9FA] px-3.5 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-[#E8EAED]">
                <GoogleMark className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[#1C1E21]">
                  {data!.connection.email}
                </p>
                <p className="text-muted-foreground text-xs">
                  {data!.connection.spreadsheetCount} spreadsheet
                  {data!.connection.spreadsheetCount === 1 ? '' : 's'} · {data!.connection.rowCount}{' '}
                  rows
                  {data!.connection.lastSyncedAt
                    ? ` · Synced ${formatWhen(data!.connection.lastSyncedAt)}`
                    : ''}
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={disconnect}
              disabled={busy !== null}
              className="text-danger shrink-0"
            >
              Disconnect
            </Button>
          </div>

          {spreadsheets.length === 0 ? (
            <p className="text-muted-foreground rounded-xl border border-dashed border-[#DADCE0] px-3 py-6 text-center text-sm">
              No spreadsheets found for this Google account.
            </p>
          ) : (
            <>
              <ul className="space-y-2.5">
                {visible.map((sheet) => (
                  <SpreadsheetPreview key={sheet.id} sheet={sheet} />
                ))}
              </ul>
              {spreadsheets.length > 4 && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setExpanded((value) => !value)}
                  className="w-full"
                >
                  {expanded ? 'Show less' : `Show all ${spreadsheets.length} spreadsheets`}
                </Button>
              )}
            </>
          )}
        </div>
      )}
    </Card>
  );
}
