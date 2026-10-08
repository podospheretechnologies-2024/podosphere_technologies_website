'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { BRAND_KIT_FIELDS, emptyBrandKit, type BrandKit } from '../../config/brand-kit';

export function BrandKitEditor() {
  const [kit, setKit] = useState<BrandKit>(emptyBrandKit());
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void fetch('/api/social/ai/brand-kit')
      .then((response) => response.json())
      .then((data: BrandKit) => setKit({ ...emptyBrandKit(), ...data }))
      .catch(() => setStatus('Could not load the brand kit'));
  }, []);

  async function save() {
    setSaving(true);
    setStatus(null);
    try {
      const response = await fetch('/api/social/ai/brand-kit', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(kit),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Save failed');
      setStatus('Brand kit saved. Podo AI will use it on the next reply.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="border-border bg-surface space-y-4 rounded-2xl border p-4">
      <div>
        <h2 className="text-sm font-semibold">Brand kit</h2>
        <p className="text-muted-foreground text-xs">Voice, audience and compliance notes for every AI reply.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {BRAND_KIT_FIELDS.map((field) => (
          <label key={field.key} className={field.long ? 'md:col-span-2' : ''}>
            <span className="text-muted-foreground mb-1 block text-xs font-medium">{field.label}</span>
            {field.long ? (
              <textarea
                value={kit[field.key]}
                placeholder={field.placeholder}
                rows={3}
                onChange={(event) => setKit((current) => ({ ...current, [field.key]: event.target.value }))}
                className="border-border bg-surface-muted/40 w-full rounded-xl border px-3 py-2 text-sm outline-none"
              />
            ) : (
              <input
                value={kit[field.key]}
                placeholder={field.placeholder}
                onChange={(event) => setKit((current) => ({ ...current, [field.key]: event.target.value }))}
                className="border-border bg-surface-muted/40 h-10 w-full rounded-xl border px-3 text-sm outline-none"
              />
            )}
          </label>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <Button type="button" onClick={() => void save()} disabled={saving}>
          {saving ? 'Saving…' : 'Save brand kit'}
        </Button>
        {status && <p className="text-muted-foreground text-xs">{status}</p>}
      </div>
    </section>
  );
}
