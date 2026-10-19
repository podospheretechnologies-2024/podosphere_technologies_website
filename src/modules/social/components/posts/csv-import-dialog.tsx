'use client';

import { Download, FileSpreadsheet, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Modal } from '@/shared/components/ui/modal';
import { cn } from '@/shared/lib/cn';
import { CSV_IMPORT_DEFAULT_TIMEZONE } from '../../config/csv-import';
import {
  browserTimeZone,
  createCsvImport,
  CSV_TEMPLATE,
  previewCsvImport,
} from '../../lib/csv-import.client';
import type { CsvImportPreviewResponse, CsvImportRowPreview } from '../../types/csv-import';

interface CsvImportDialogProps {
  open: boolean;
  onClose: () => void;
  onImported: (created: number) => void;
}

function downloadTemplate() {
  const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'podo-social-bulk-schedule.csv';
  anchor.click();
  URL.revokeObjectURL(url);
}

function toCreateRows(rows: CsvImportRowPreview[]) {
  return rows
    .filter((row) => row.valid && row.publishAt)
    .map((row) => ({
      rowIndex: row.rowIndex,
      publishAt: row.publishAt!,
      channelIds: row.channelIds,
      text: row.text,
      mediaUrls: row.mediaUrls,
    }));
}

export function CsvImportDialog({ open, onClose, onImported }: CsvImportDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [timeZone, setTimeZone] = useState(() => browserTimeZone());
  const [preview, setPreview] = useState<CsvImportPreviewResponse | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setPreview(null);
    setFileName(null);
    setError(null);
    setBusy(false);
    if (inputRef.current) inputRef.current.value = '';
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function onFileChange(file: File | null) {
    if (!file) return;
    setBusy(true);
    setError(null);
    setFileName(file.name);
    try {
      const next = await previewCsvImport(file, timeZone || CSV_IMPORT_DEFAULT_TIMEZONE);
      setPreview(next);
    } catch (failure) {
      setPreview(null);
      setError(failure instanceof Error ? failure.message : 'Could not parse CSV');
    } finally {
      setBusy(false);
    }
  }

  async function importValid() {
    if (!preview) return;
    const rows = toCreateRows(preview.rows);
    if (rows.length === 0) {
      setError('No valid rows to import. Fix errors and re-upload.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await createCsvImport(rows, preview.timeZone);
      onImported(result.created);
      handleClose();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Import failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      size="lg"
      title="Bulk schedule from CSV"
      description="Upload a CSV with date, time, channels, text, and optional media URLs. Preview row errors, then create scheduled post groups."
      onClose={handleClose}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={downloadTemplate}>
            <Download className="size-3.5" />
            Download template
          </Button>
          <label className="text-muted-foreground flex items-center gap-2 text-sm">
            Time zone
            <input
              value={timeZone}
              onChange={(event) => setTimeZone(event.target.value)}
              className="border-border bg-surface h-8 w-44 rounded-md border px-2 text-sm"
              list="csv-import-timezones"
              aria-label="Time zone for schedule times"
            />
            <datalist id="csv-import-timezones">
              <option value="Asia/Kolkata" />
              <option value="UTC" />
              <option value="America/New_York" />
              <option value="Europe/London" />
            </datalist>
          </label>
        </div>

        <div className="border-border bg-surface-muted/40 flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-4 py-8">
          <FileSpreadsheet className="text-muted-foreground size-8" />
          <p className="text-muted-foreground max-w-md text-center text-sm">
            Columns: <code className="text-foreground">date</code>,{' '}
            <code className="text-foreground">time</code>,{' '}
            <code className="text-foreground">channels</code>,{' '}
            <code className="text-foreground">text</code>,{' '}
            <code className="text-foreground">media_url</code> (optional). Channels may be
            names, @usernames, provider ids, or channel ids (comma-separated).
          </p>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(event) => void onFileChange(event.target.files?.[0] ?? null)}
          />
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="size-3.5" />
            {fileName ? 'Replace CSV' : 'Upload CSV'}
          </Button>
          {fileName && <p className="text-muted-foreground text-xs">{fileName}</p>}
        </div>

        {error && (
          <div
            role="alert"
            className="border-danger/40 bg-danger/10 text-danger rounded-lg border p-3 text-sm"
          >
            {error}
          </div>
        )}

        {preview && (
          <div className="space-y-3">
            <div className="text-muted-foreground flex flex-wrap gap-3 text-xs">
              <span>
                Mapped:{' '}
                {[
                  preview.mapped.date && `date→${preview.mapped.date}`,
                  preview.mapped.time && `time→${preview.mapped.time}`,
                  preview.mapped.channels && `channels→${preview.mapped.channels}`,
                  preview.mapped.text && `text→${preview.mapped.text}`,
                  preview.mapped.mediaUrl && `media→${preview.mapped.mediaUrl}`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
              <span className="text-success font-medium">{preview.validCount} valid</span>
              {preview.errorCount > 0 && (
                <span className="text-danger font-medium">{preview.errorCount} with errors</span>
              )}
              <span>TZ {preview.timeZone}</span>
            </div>

            <div className="border-border max-h-72 overflow-auto rounded-xl border">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-surface-muted text-muted-foreground sticky top-0 text-xs uppercase">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Row</th>
                    <th className="px-3 py-2 font-semibold">When</th>
                    <th className="px-3 py-2 font-semibold">Channels</th>
                    <th className="px-3 py-2 font-semibold">Text</th>
                    <th className="px-3 py-2 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row) => (
                    <tr
                      key={row.rowIndex}
                      className={cn(
                        'border-border border-t align-top',
                        !row.valid && 'bg-danger/5'
                      )}
                    >
                      <td className="px-3 py-2 tabular-nums">{row.rowIndex}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {row.date ?? '—'} {row.time ?? ''}
                      </td>
                      <td className="px-3 py-2">
                        {row.channelNames.length
                          ? row.channelNames.join(', ')
                          : row.channels.join(', ') || '—'}
                      </td>
                      <td className="px-3 py-2">
                        <p className="line-clamp-2 max-w-xs">{row.text || '—'}</p>
                        {row.mediaUrls.length > 0 && (
                          <p className="text-muted-foreground mt-0.5 text-xs">
                            {row.mediaUrls.length} media URL
                            {row.mediaUrls.length === 1 ? '' : 's'}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {row.valid ? (
                          <span className="text-success text-xs font-medium">OK</span>
                        ) : (
                          <ul className="text-danger list-inside list-disc text-xs">
                            {row.errors.map((err) => (
                              <li key={err}>{err}</li>
                            ))}
                          </ul>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={handleClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void importValid()}
            disabled={busy || !preview || preview.validCount === 0}
          >
            {busy
              ? 'Working…'
              : preview
                ? `Schedule ${preview.validCount} post${preview.validCount === 1 ? '' : 's'}`
                : 'Schedule'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
