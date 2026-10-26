'use client';

import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { cn } from '@/shared/lib/cn';
import {
  BIO_LINK_LABEL_MAX_LENGTH,
  BIO_PAGE_HEADLINE_MAX_LENGTH,
  BIO_PAGE_MAX_LINKS,
  BIO_PAGE_SLUG_MAX_LENGTH,
  BIO_PAGE_THEMES,
  BIO_PAGE_TITLE_MAX_LENGTH,
} from '../../config/settings';
import { useBioPages } from '../../hooks/use-bio-pages';
import { deleteBioPage, saveBioPage } from '../../lib/bio-pages.client';
import type { BioPageItem } from '../../types/bio';

interface LinkDraft {
  key: string;
  id?: string;
  label: string;
  url: string;
  clicks: number;
}

interface Draft {
  id?: string;
  title: string;
  slug: string;
  headline: string;
  avatarUrl: string;
  theme: string;
  published: boolean;
  links: LinkDraft[];
}

function emptyDraft(): Draft {
  return { title: '', slug: '', headline: '', avatarUrl: '', theme: 'light', published: false, links: [] };
}

function toDraft(page: BioPageItem): Draft {
  return {
    id: page.id,
    title: page.title,
    slug: page.slug,
    headline: page.headline ?? '',
    avatarUrl: page.avatarUrl ?? '',
    theme: page.theme,
    published: page.published,
    links: page.links.map((link) => ({
      key: crypto.randomUUID(),
      id: link.id,
      label: link.label,
      url: link.url,
      clicks: link.clicks,
    })),
  };
}

function publicUrl(slug: string): string {
  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  return `${origin}/b/${slug}`;
}

export function BioPagesPanel() {
  const { data, error, mutate } = useBioPages();
  const [draft, setDraft] = useState<Draft | null>(null);

  function select(page: BioPageItem) {
    setDraft(toDraft(page));
  }

  return (
    <div className="flex min-h-[70vh] flex-col gap-4 lg:flex-row">
      <aside className="lg:w-72 lg:shrink-0">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold">Bio pages</h2>
          <Button size="sm" onClick={() => setDraft(emptyDraft())}>
            New page
          </Button>
        </div>

        {error && !data ? (
          <p className="text-danger text-sm">
            {error instanceof Error ? error.message : 'Could not load pages'}
          </p>
        ) : !data ? (
          <p className="text-muted-foreground text-sm">Loading…</p>
        ) : data.length === 0 ? (
          <p className="text-muted-foreground text-sm">No bio pages yet. Create your first one.</p>
        ) : (
          <ul className="space-y-1.5">
            {data.map((page) => (
              <li key={page.id}>
                <button
                  type="button"
                  onClick={() => select(page)}
                  className={cn(
                    'border-border bg-surface hover:bg-surface-muted w-full rounded-lg border p-3 text-left transition',
                    draft?.id === page.id && 'border-primary'
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">{page.title}</span>
                    <span
                      className={cn(
                        'shrink-0 rounded-full px-2 py-0.5 text-xs',
                        page.published
                          ? 'bg-success/15 text-success'
                          : 'bg-surface-muted text-muted-foreground'
                      )}
                    >
                      {page.published ? 'Live' : 'Draft'}
                    </span>
                  </div>
                  <p className="text-muted-foreground mt-0.5 truncate text-xs">
                    /b/{page.slug} · {page.views} views
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      <div className="min-w-0 flex-1">
        {draft ? (
          <BioPageEditor
            key={draft.id ?? 'new'}
            draft={draft}
            onDone={() => {
              setDraft(null);
              void mutate();
            }}
            onSavedId={(saved) => {
              setDraft(toDraft(saved));
              void mutate();
            }}
          />
        ) : (
          <Card className="text-muted-foreground flex h-full items-center justify-center text-sm">
            Select a page on the left, or create a new one.
          </Card>
        )}
      </div>
    </div>
  );
}

interface BioPageEditorProps {
  draft: Draft;
  onDone: () => void;
  onSavedId: (page: BioPageItem) => void;
}

function BioPageEditor({ draft: initial, onDone, onSavedId }: BioPageEditorProps) {
  const [draft, setDraft] = useState<Draft>(initial);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function setLink(key: string, patch: Partial<LinkDraft>) {
    setDraft((current) => ({
      ...current,
      links: current.links.map((link) => (link.key === key ? { ...link, ...patch } : link)),
    }));
  }

  function addLink() {
    setDraft((current) =>
      current.links.length >= BIO_PAGE_MAX_LINKS
        ? current
        : {
            ...current,
            links: [...current.links, { key: crypto.randomUUID(), label: '', url: '', clicks: 0 }],
          }
    );
  }

  function removeLink(key: string) {
    setDraft((current) => ({ ...current, links: current.links.filter((link) => link.key !== key) }));
  }

  function moveLink(key: string, direction: -1 | 1) {
    setDraft((current) => {
      const index = current.links.findIndex((link) => link.key === key);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.links.length) return current;
      const links = [...current.links];
      [links[index], links[target]] = [links[target], links[index]];
      return { ...current, links };
    });
  }

  async function save() {
    setErr(null);
    setSaving(true);
    try {
      const saved = await saveBioPage(
        {
          slug: draft.slug.trim() || undefined,
          title: draft.title,
          headline: draft.headline.trim() || null,
          avatarUrl: draft.avatarUrl.trim() || null,
          theme: draft.theme,
          published: draft.published,
          links: draft.links
            .filter((link) => link.label.trim() || link.url.trim())
            .map((link) => ({ id: link.id, label: link.label, url: link.url })),
        },
        draft.id
      );
      onSavedId(saved);
    } catch (saveError) {
      setErr(saveError instanceof Error ? saveError.message : 'Could not save the page');
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!draft.id) {
      onDone();
      return;
    }
    if (!window.confirm(`Delete "${draft.title}"? The public link will stop working.`)) {
      return;
    }
    setDeleting(true);
    try {
      await deleteBioPage(draft.id);
      onDone();
    } catch (deleteError) {
      setErr(deleteError instanceof Error ? deleteError.message : 'Could not delete');
      setDeleting(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(publicUrl(draft.slug));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be unavailable; the link is shown next to the button anyway.
    }
  }

  const busy = saving || deleting;

  return (
    <Card className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-base font-semibold">{draft.id ? 'Edit page' : 'New page'}</h2>
        <Button variant="danger-ghost" size="sm" onClick={remove} disabled={busy}>
          {draft.id ? 'Delete' : 'Discard'}
        </Button>
      </div>

      {draft.id && draft.published && (
        <div className="border-border bg-surface-muted/40 flex flex-wrap items-center gap-2 rounded-lg border p-3 text-sm">
          <span className="text-muted-foreground truncate">{publicUrl(draft.slug)}</span>
          <div className="ml-auto flex gap-1">
            <Button variant="ghost" size="sm" onClick={copyLink}>
              {copied ? 'Copied' : 'Copy'}
            </Button>
            <a
              href={publicUrl(draft.slug)}
              target="_blank"
              rel="noopener"
              className="border-border bg-surface hover:bg-surface-muted inline-flex h-8 items-center rounded-lg border px-3 text-sm font-medium transition"
            >
              Open
            </a>
          </div>
        </div>
      )}

      <label className="block space-y-1.5 text-sm font-medium">
        <span>Title</span>
        <Input
          value={draft.title}
          onChange={(event) => set('title', event.target.value)}
          maxLength={BIO_PAGE_TITLE_MAX_LENGTH}
          placeholder="e.g. Acme Store"
        />
      </label>

      <label className="block space-y-1.5 text-sm font-medium">
        <span>Link (slug)</span>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-sm">/b/</span>
          <Input
            value={draft.slug}
            onChange={(event) => set('slug', event.target.value)}
            maxLength={BIO_PAGE_SLUG_MAX_LENGTH}
            placeholder="acme (leave blank to auto-generate)"
          />
        </div>
      </label>

      <label className="block space-y-1.5 text-sm font-medium">
        <span>Headline</span>
        <Input
          value={draft.headline}
          onChange={(event) => set('headline', event.target.value)}
          maxLength={BIO_PAGE_HEADLINE_MAX_LENGTH}
          placeholder="A short tagline shown under the title"
        />
      </label>

      <label className="block space-y-1.5 text-sm font-medium">
        <span>Avatar image URL</span>
        <Input
          value={draft.avatarUrl}
          onChange={(event) => set('avatarUrl', event.target.value)}
          placeholder="https://…/logo.png"
        />
      </label>

      <div className="space-y-1.5 text-sm font-medium">
        <span>Theme</span>
        <div className="flex gap-2">
          {BIO_PAGE_THEMES.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => set('theme', name)}
              className={cn(
                'border-border bg-surface hover:bg-surface-muted rounded-lg border px-3 py-1.5 text-sm capitalize transition',
                draft.theme === name && 'border-primary text-foreground'
              )}
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Links</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={addLink}
            disabled={draft.links.length >= BIO_PAGE_MAX_LINKS}
          >
            Add link
          </Button>
        </div>
        {draft.links.length === 0 ? (
          <p className="text-muted-foreground text-sm">No links yet.</p>
        ) : (
          <ul className="space-y-2">
            {draft.links.map((link, index) => (
              <li key={link.key} className="border-border bg-surface-muted/30 rounded-lg border p-3">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    value={link.label}
                    onChange={(event) => setLink(link.key, { label: event.target.value })}
                    maxLength={BIO_LINK_LABEL_MAX_LENGTH}
                    placeholder="Button label"
                    className="sm:w-48"
                  />
                  <Input
                    value={link.url}
                    onChange={(event) => setLink(link.key, { url: event.target.value })}
                    placeholder="https://…"
                    className="flex-1"
                  />
                </div>
                <div className="text-muted-foreground mt-2 flex items-center gap-1 text-xs">
                  <span className="mr-auto">{link.clicks} clicks</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => moveLink(link.key, -1)}
                    disabled={index === 0}
                  >
                    ↑
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => moveLink(link.key, 1)}
                    disabled={index === draft.links.length - 1}
                  >
                    ↓
                  </Button>
                  <Button variant="danger-ghost" size="sm" onClick={() => removeLink(link.key)}>
                    Remove
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          checked={draft.published}
          onChange={(event) => set('published', event.target.checked)}
          className="h-4 w-4"
        />
        <span>Published (publicly visible)</span>
      </label>

      {err && (
        <div
          role="alert"
          className="border-danger/40 bg-danger/10 text-danger rounded-lg border p-3 text-sm"
        >
          {err}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone} disabled={busy}>
          Close
        </Button>
        <Button onClick={save} disabled={busy || !draft.title.trim()}>
          {saving ? 'Saving…' : 'Save page'}
        </Button>
      </div>
    </Card>
  );
}
