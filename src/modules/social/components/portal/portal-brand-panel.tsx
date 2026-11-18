'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { apiFetch, ApiError } from '@/shared/lib/fetcher';

type BrandField = {
  key: string;
  label: string;
  placeholder: string;
  long: boolean;
  value: string;
};

type BrandMedia = {
  id: string;
  name: string;
  url: string;
  type: 'image' | 'video';
  thumbnailUrl: string | null;
};

type BrandDto = { fields: BrandField[]; media: BrandMedia[] };

export function PortalBrandPanel({ canAct = true }: { canAct?: boolean }) {
  const [fields, setFields] = useState<BrandField[]>([]);
  const [media, setMedia] = useState<BrandMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<BrandDto>('/api/portal/brand');
      setFields(data.fields);
      setMedia(data.media);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load media library.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function onSave(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const body = Object.fromEntries(fields.map((field) => [field.key, field.value]));
      const data = await apiFetch<BrandDto>('/api/portal/brand', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      setFields(data.fields);
      setMedia(data.media);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save brand kit.');
    } finally {
      setSaving(false);
    }
  }

  async function onUpload(file: File | null) {
    if (!file || !canAct) return;
    setUploading(true);
    setError(null);
    try {
      const res = await fetch('/api/portal/brand/media', {
        method: 'POST',
        headers: {
          'x-file-name': encodeURIComponent(file.name),
          'Content-Type': file.type || 'application/octet-stream',
        },
        body: file,
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? 'Upload failed');
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading media…</p>;
  }

  return (
    <>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-foreground">Media</h2>
        <p className="mt-1 text-muted-foreground">
          Your library of photos and videos, plus brand notes your agency uses.
        </p>
      </div>

      {error ? <p className="text-danger mb-4 text-sm">{error}</p> : null}

      <section className="mb-10">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-foreground">Media library</h3>
          {canAct ? (
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-foreground hover:bg-surface-muted">
              <input
                type="file"
                accept="image/*,video/mp4"
                className="hidden"
                disabled={uploading}
                onChange={(event) => void onUpload(event.target.files?.[0] ?? null)}
              />
              {uploading ? 'Uploading…' : 'Upload'}
            </label>
          ) : (
            <button
              type="button"
              disabled
              className="cursor-not-allowed rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm font-medium text-muted-foreground"
            >
              Upload
            </button>
          )}
        </div>

        {media.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface p-12 text-center text-muted-foreground">
            No files in your library yet.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {media.map((item) => {
              const preview = item.type === 'video' ? (item.thumbnailUrl ?? item.url) : item.url;
              return (
                <a
                  key={item.id}
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={preview}
                    alt={item.name}
                    className="aspect-square w-full object-cover"
                  />
                  <div className="flex items-center justify-between gap-1 px-2 py-1.5">
                    <p className="truncate text-xs text-muted-foreground">{item.name}</p>
                    {item.type === 'video' ? (
                      <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        Video
                      </span>
                    ) : null}
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h3 className="mb-3 text-lg font-semibold text-foreground">Brand kit</h3>
        <p className="mb-4 text-sm text-muted-foreground">
          Logo notes, colours, tone, and product details your agency can use.
        </p>
        <form onSubmit={onSave} className="space-y-4">
          <fieldset disabled={!canAct} className="space-y-4">
            {fields.map((field) => (
              <div key={field.key}>
                <label
                  htmlFor={field.key}
                  className="mb-1.5 block text-sm font-medium text-foreground"
                >
                  {field.label}
                </label>
                {field.long ? (
                  <textarea
                    id={field.key}
                    rows={3}
                    value={field.value}
                    placeholder={field.placeholder}
                    onChange={(event) =>
                      setFields((rows) =>
                        rows.map((row) =>
                          row.key === field.key ? { ...row, value: event.target.value } : row
                        )
                      )
                    }
                    className="border-border bg-surface w-full rounded-lg border px-3 py-2 text-sm"
                  />
                ) : (
                  <Input
                    id={field.key}
                    value={field.value}
                    placeholder={field.placeholder}
                    onChange={(event) =>
                      setFields((rows) =>
                        rows.map((row) =>
                          row.key === field.key ? { ...row, value: event.target.value } : row
                        )
                      )
                    }
                  />
                )}
              </div>
            ))}
          </fieldset>
          {canAct ? (
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : saved ? 'Saved' : 'Save brand kit'}
            </Button>
          ) : null}
        </form>
      </section>
    </>
  );
}
