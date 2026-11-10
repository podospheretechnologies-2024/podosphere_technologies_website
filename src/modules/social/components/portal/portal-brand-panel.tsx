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

type BrandMedia = { id: string; name: string; url: string; type: 'image' | 'video' };

type BrandDto = { fields: BrandField[]; media: BrandMedia[] };

export function PortalBrandPanel() {
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
      setError(err instanceof ApiError ? err.message : 'Could not load brand kit.');
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
    if (!file) return;
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
    return <p className="text-sm text-gray-500">Loading brand kit…</p>;
  }

  return (
    <>
      <div className="mb-8">
        <h2 className="text-2xl font-bold">Brand kit</h2>
        <p className="mt-1 text-gray-500">
          Share logo notes, colours, tone, and product photos your agency can use.
        </p>
      </div>

      {error ? <p className="text-danger mb-4 text-sm">{error}</p> : null}

      <form onSubmit={onSave} className="mb-10 space-y-4">
        {fields.map((field) => (
          <div key={field.key}>
            <label htmlFor={field.key} className="mb-1.5 block text-sm font-medium text-gray-900">
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
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving…' : saved ? 'Saved' : 'Save brand kit'}
        </Button>
      </form>

      <section>
        <h3 className="mb-3 text-lg font-semibold text-gray-900">Product photos & logo files</h3>
        <label className="mb-4 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium hover:bg-gray-50">
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={uploading}
            onChange={(event) => void onUpload(event.target.files?.[0] ?? null)}
          />
          {uploading ? 'Uploading…' : 'Upload image'}
        </label>

        {media.length === 0 ? (
          <p className="text-sm text-gray-500">No images uploaded yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {media.map((item) => (
              <a
                key={item.id}
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.url} alt={item.name} className="aspect-square w-full object-cover" />
                <p className="truncate px-2 py-1.5 text-xs text-gray-600">{item.name}</p>
              </a>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
