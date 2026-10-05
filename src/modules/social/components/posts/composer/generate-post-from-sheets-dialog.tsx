'use client';

import { ExternalLink, RefreshCw, Sheet } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { useGoogleSheets } from '../../../hooks/use-automation';
import {
  fetchGoogleSheetsContent,
  refreshGoogleSheets,
  startGoogleSheetsConnect,
} from '../../../lib/google-sheets.client';
import type { GoogleSheetRow, GoogleSpreadsheetItem } from '../../../types/google-sheets';

interface GeneratePostFromSheetsDialogProps {
  open: boolean;
  postDate: string;
  onClose: () => void;
  onApply: (content: string) => void;
}

function toDateOnly(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }
  return parsed.toISOString().slice(0, 10);
}

export function GeneratePostFromSheetsDialog({
  open,
  postDate,
  onClose,
  onApply,
}: GeneratePostFromSheetsDialogProps) {
  const date = toDateOnly(postDate || new Date().toISOString());
  const { data, error, mutate } = useGoogleSheets(false);
  const [mode, setMode] = useState<'auto' | 'browse'>('auto');
  const [autoContent, setAutoContent] = useState<string | null>(null);
  const [autoMeta, setAutoMeta] = useState<string | null>(null);
  const [selectedSheetId, setSelectedSheetId] = useState<string | null>(null);
  const [selectedRow, setSelectedRow] = useState<GoogleSheetRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const spreadsheets = data?.spreadsheets ?? [];
  const activeSheet: GoogleSpreadsheetItem | null = useMemo(
    () => spreadsheets.find((sheet) => sheet.id === selectedSheetId) ?? spreadsheets[0] ?? null,
    [spreadsheets, selectedSheetId]
  );

  const filteredRows = useMemo(() => {
    if (!activeSheet) return [];
    const q = search.trim().toLowerCase();
    if (!q) return activeSheet.rows;
    return activeSheet.rows.filter(
      (row) =>
        row.content.toLowerCase().includes(q) ||
        (row.dateValue ?? '').includes(q) ||
        Object.values(row.values).some((value) => value.toLowerCase().includes(q))
    );
  }, [activeSheet, search]);

  useEffect(() => {
    if (!open) return;
    setMode('auto');
    setSelectedRow(null);
    setActionError(null);
    setSearch('');
  }, [open, date]);

  useEffect(() => {
    if (!open || !data?.connection.connected) return;
    let cancelled = false;
    setBusy(true);
    setActionError(null);
    fetchGoogleSheetsContent(date)
      .then((match) => {
        if (cancelled) return;
        if (match.row?.content) {
          setAutoContent(match.row.content);
          setAutoMeta(
            match.spreadsheet
              ? `${match.spreadsheet.name}${match.row.sheetName ? ` · ${match.row.sheetName}` : ''} · row ${match.row.rowIndex}`
              : null
          );
        } else {
          setAutoContent(null);
          setAutoMeta(null);
        }
      })
      .catch((failure) => {
        if (cancelled) return;
        setActionError(failure instanceof Error ? failure.message : 'Could not load sheet content');
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, date, data?.connection.connected]);

  if (!open) return null;

  async function connect() {
    setBusy(true);
    try {
      await startGoogleSheetsConnect();
    } catch (failure) {
      setActionError(failure instanceof Error ? failure.message : 'Could not start Google connect');
      setBusy(false);
    }
  }

  async function refresh() {
    setBusy(true);
    setActionError(null);
    try {
      const next = await refreshGoogleSheets();
      await mutate(next, { revalidate: false });
      const match = await fetchGoogleSheetsContent(date);
      setAutoContent(match.row?.content ?? null);
      setAutoMeta(
        match.row && match.spreadsheet
          ? `${match.spreadsheet.name} · row ${match.row.rowIndex}`
          : null
      );
    } catch (failure) {
      setActionError(failure instanceof Error ? failure.message : 'Refresh failed');
    } finally {
      setBusy(false);
    }
  }

  function apply() {
    const content =
      mode === 'browse' && selectedRow?.content
        ? selectedRow.content
        : autoContent?.trim() || '';
    if (!content) {
      setActionError('No Google Sheet content selected for this date.');
      return;
    }
    onApply(content);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close generate post dialog"
        onClick={onClose}
      />
      <div className="border-border bg-surface relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border shadow-xl">
        <div className="border-border flex items-start justify-between gap-3 border-b px-4 py-3">
          <div>
            <div className="flex items-center gap-2">
              <Sheet className="size-4 text-[#0F9D58]" />
              <h2 className="text-base font-semibold">Generate Post from Sheets</h2>
            </div>
            <p className="text-muted-foreground text-sm">
              Pull content for <span className="text-foreground font-medium">{date}</span>. Pick a
              past row anytime, or use today&apos;s automatic match.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground rounded-md px-2 py-1 text-sm"
          >
            Close
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
          {error && !data ? (
            <p className="text-danger text-sm">
              {error instanceof Error ? error.message : 'Could not load Google Sheets'}
            </p>
          ) : !data ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : !data.connection.connected ? (
            <div className="space-y-3">
              <p className="text-muted-foreground text-sm">
                Connect Google Sheets in Plugs first, or connect here.
              </p>
              {!data.connection.configured && (
                <p className="text-muted-foreground text-sm">
                  Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env, then restart.
                </p>
              )}
              <Button onClick={connect} disabled={busy || !data.connection.configured}>
                Connect Google Account
              </Button>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={mode === 'auto' ? 'primary' : 'secondary'}
                  onClick={() => setMode('auto')}
                >
                  Auto for date
                </Button>
                <Button
                  size="sm"
                  variant={mode === 'browse' ? 'primary' : 'secondary'}
                  onClick={() => setMode('browse')}
                >
                  Browse past content
                </Button>
                <Button size="sm" variant="secondary" onClick={refresh} disabled={busy}>
                  <RefreshCw className={`size-3.5 ${busy ? 'animate-spin' : ''}`} />
                  Refresh sheets
                </Button>
              </div>

              {actionError && (
                <div
                  role="alert"
                  className="border-danger/40 bg-danger/10 text-danger rounded-lg border p-3 text-sm"
                >
                  {actionError}
                </div>
              )}

              {mode === 'auto' ? (
                <div className="border-border space-y-2 rounded-xl border p-3">
                  <p className="text-xs font-semibold tracking-wide uppercase">
                    Matched for {date}
                  </p>
                  {busy && !autoContent ? (
                    <p className="text-muted-foreground text-sm">Looking up sheet rows…</p>
                  ) : autoContent ? (
                    <>
                      {autoMeta && <p className="text-muted-foreground text-xs">{autoMeta}</p>}
                      <p className="whitespace-pre-wrap text-sm">{autoContent}</p>
                    </>
                  ) : (
                    <p className="text-muted-foreground text-sm">
                      No dated row found for {date}. Switch to Browse and pick past content, or add
                      a Date + Content column in your sheet.
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {spreadsheets.map((sheet) => (
                      <button
                        key={sheet.id}
                        type="button"
                        onClick={() => {
                          setSelectedSheetId(sheet.id);
                          setSelectedRow(null);
                        }}
                        className={
                          (activeSheet?.id === sheet.id
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border hover:bg-surface-muted') +
                          ' rounded-full border px-3 py-1 text-xs font-medium'
                        }
                      >
                        {sheet.name}
                      </button>
                    ))}
                  </div>

                  {activeSheet && (
                    <>
                      <div className="flex items-center justify-between gap-2">
                        <input
                          value={search}
                          onChange={(event) => setSearch(event.target.value)}
                          placeholder="Search rows…"
                          className="border-border bg-surface focus:border-primary h-9 w-full rounded-lg border px-3 text-sm outline-none"
                        />
                        <a
                          href={activeSheet.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-foreground inline-flex size-9 shrink-0 items-center justify-center rounded-lg border"
                          title="Open Google Sheet"
                        >
                          <ExternalLink className="size-3.5" />
                        </a>
                      </div>
                      <ul className="max-h-64 space-y-1 overflow-y-auto">
                        {filteredRows.length === 0 ? (
                          <li className="text-muted-foreground text-sm">No rows in this sheet.</li>
                        ) : (
                          filteredRows.map((row) => {
                            const active =
                              selectedRow?.sheetName === row.sheetName &&
                              selectedRow?.rowIndex === row.rowIndex;
                            return (
                              <li key={`${row.sheetName}-${row.rowIndex}`}>
                                <button
                                  type="button"
                                  onClick={() => setSelectedRow(row)}
                                  className={
                                    (active
                                      ? 'border-primary bg-primary/10'
                                      : 'border-border hover:bg-surface-muted') +
                                    ' w-full rounded-lg border px-3 py-2 text-left'
                                  }
                                >
                                  <p className="text-muted-foreground text-[11px]">
                                    {row.dateValue ?? 'No date'} · {row.sheetName} · row{' '}
                                    {row.rowIndex}
                                  </p>
                                  <p className="line-clamp-2 text-sm">{row.content || 'Empty'}</p>
                                </button>
                              </li>
                            );
                          })
                        )}
                      </ul>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {data?.connection.connected && (
          <div className="border-border flex justify-end gap-2 border-t px-4 py-3">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={apply} disabled={busy}>
              Use in post
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
