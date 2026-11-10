'use client';

import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { errorText, growthCall, useGrowth } from './growth-api';
import { CopyButton, Empty, ErrorLine, Field, Panel, Pill, statusTone, textareaClass } from './growth-ui';

interface Blog {
  id: string;
  title: string;
  slug: string | null;
  metaDescription: string | null;
  keywords: string | null;
  angle: string | null;
  bodyHtml: string | null;
  productLinks: { text: string; url: string }[];
  coverImageUrl: string | null;
  status: string;
  feedback: string | null;
  writeNext: boolean;
  publishedUrl: string | null;
  publishedAt: string | null;
  createdAt: string;
}

const LABEL: Record<string, string> = {
  idea: 'Idea',
  draft: 'Draft to review',
  changes: 'Changes asked',
  approved: 'Approved',
  published: 'Published',
  rejected: 'Rejected',
};
const ORDER: Record<string, number> = { draft: 0, changes: 1, approved: 2, idea: 3, published: 4, rejected: 5 };

/** Strips tags for the plain-text copy and preview. The HTML itself is rendered only as text, never injected. */
function plain(html: string): string {
  return html
    .replace(/<\/(p|h2|h3|li)>/gi, '\n')
    .replace(/<li>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function BlogsTab({ onChange, storeConnected }: { onChange: () => void; storeConnected: boolean }) {
  const { data, error, mutate } = useGrowth<{ blogs: Blog[]; perMonth: number; canReview: boolean }>('/blogs');
  const [busy, setBusy] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const blogs = [...(data?.blogs ?? [])].sort((a, b) => (ORDER[a.status] ?? 9) - (ORDER[b.status] ?? 9));
  const month = new Date().toISOString().slice(0, 7);
  const thisMonth = blogs.filter((b) => b.createdAt.startsWith(month) && ['draft', 'changes', 'approved', 'published'].includes(b.status)).length;
  const perMonth = data?.perMonth ?? 5;
  const reload = () => {
    void mutate();
    onChange();
  };

  async function ideas() {
    setBusy(true);
    setGenError(null);
    try {
      await growthCall('/blogs', 'POST', { generate: true });
      reload();
    } catch (e) {
      setGenError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function addIdea() {
    setGenError(null);
    try {
      await growthCall('/blogs', 'POST', { title });
      setTitle('');
      reload();
    } catch (e) {
      setGenError(errorText(e));
    }
  }

  return (
    <Panel
      title="SEO blogs"
      action={
        <span className="text-muted-foreground text-xs">
          {blogs.filter((b) => b.status === 'published').length} published · {thisMonth} of {perMonth} written this month
        </span>
      }
    >
      <p className="text-muted-foreground text-xs">
        {perMonth} blogs a month on topics people search for now. Read the draft, change anything that doesn&apos;t sound right, then approve. An approved
        blog goes to the store&apos;s blog only when someone presses Publish.
        {!storeConnected && ' Connect the Shopify store (Setup) to publish.'}
      </p>
      <div className="bg-surface-muted h-2 overflow-hidden rounded-full">
        <i className="bg-success block h-full" style={{ width: `${Math.min(100, (thisMonth / Math.max(1, perMonth)) * 100)}%` }} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="ai" disabled={busy} onClick={ideas}>
          {busy ? 'Finding topics…' : `Suggest ${perMonth} topics`}
        </Button>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Or add your own topic" className="min-w-60 flex-1" />
        <Button variant="secondary" disabled={title.trim().length < 3} onClick={addIdea}>
          Add topic
        </Button>
      </div>
      <ErrorLine error={genError ?? error?.message ?? null} />
      {!blogs.length && <Empty>Blog ideas and drafts appear here.</Empty>}
      <div className="flex flex-col gap-3">
        {blogs.map((b, i) => (
          <BlogRow key={b.id} blog={b} open={i === 0 && b.status !== 'idea'} canReview={data?.canReview ?? false} storeConnected={storeConnected} onDone={reload} />
        ))}
      </div>
    </Panel>
  );
}

function BlogRow({
  blog,
  open,
  canReview,
  storeConnected,
  onDone,
}: {
  blog: Blog;
  open: boolean;
  canReview: boolean;
  storeConnected: boolean;
  onDone: () => void;
}) {
  const [feedback, setFeedback] = useState(blog.feedback ?? '');
  const [cover, setCover] = useState(blog.coverImageUrl ?? '');
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(blog.bodyHtml ?? '');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(label: string, fn: () => Promise<unknown>) {
    setBusy(label);
    setError(null);
    try {
      await fn();
      onDone();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  }
  const patch = (body: Record<string, unknown>) => growthCall(`/blogs/${blog.id}`, 'PATCH', body);

  return (
    <details open={open} className="border-border bg-surface-muted/40 rounded-xl border">
      <summary className="flex cursor-pointer flex-wrap items-center gap-2 px-4 py-3 font-semibold">
        <span className="break-words">{blog.title}</span>
        <Pill tone={statusTone(blog.status)}>{LABEL[blog.status] ?? blog.status}</Pill>
      </summary>
      <div className="flex flex-col gap-3 px-4 pb-4">
        {blog.angle && <p className="text-muted-foreground text-xs">Angle: {blog.angle}</p>}
        {blog.keywords && <p className="text-muted-foreground text-xs">Keywords: {blog.keywords}</p>}
        {blog.publishedUrl && (
          <a href={blog.publishedUrl} target="_blank" rel="noopener noreferrer" className="text-primary text-sm underline">
            Open the published blog
          </a>
        )}
        {blog.bodyHtml && !editing && (
          <div className="bg-surface max-h-96 overflow-y-auto rounded-lg p-3 text-sm whitespace-pre-wrap">{plain(blog.bodyHtml)}</div>
        )}
        {editing && <textarea className={`${textareaClass} min-h-96 font-mono text-xs`} value={body} onChange={(e) => setBody(e.target.value)} />}
        {blog.metaDescription && <p className="text-xs">Search description: {blog.metaDescription}</p>}
        {blog.productLinks.length > 0 && (
          <div className="flex flex-col gap-1 text-xs">
            <span className="text-muted-foreground font-semibold uppercase">Store links in the blog</span>
            {blog.productLinks.map((l) => (
              <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                {l.text || l.url}
              </a>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {blog.bodyHtml && <CopyButton label="Copy blog text" text={plain(blog.bodyHtml)} />}
          {blog.bodyHtml && <CopyButton label="Copy HTML" text={blog.bodyHtml} />}
          {blog.metaDescription && <CopyButton label="Copy description" text={blog.metaDescription} />}
        </div>

        {blog.status !== 'published' && (
          <div className="flex flex-wrap gap-2">
            {(blog.status === 'idea' || blog.status === 'changes' || blog.status === 'draft') && (
              <Button size="sm" variant="ai" disabled={Boolean(busy)} onClick={() => run('write', () => growthCall(`/blogs/${blog.id}/write`, 'POST'))}>
                {busy === 'write' ? 'Writing (about a minute)…' : blog.bodyHtml ? 'Rewrite with the notes' : 'Write this blog'}
              </Button>
            )}
            {blog.bodyHtml && !editing && (
              <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
                Edit text
              </Button>
            )}
            {editing && (
              <Button size="sm" onClick={() => run('save', async () => (await patch({ bodyHtml: body }), setEditing(false)))}>
                Save text
              </Button>
            )}
          </div>
        )}

        {canReview && ['draft', 'changes'].includes(blog.status) && blog.bodyHtml && (
          <div className="flex flex-col gap-2">
            <Field label="Cover image URL (https, optional — upload it in Media and paste the link)">
              <Input value={cover} onChange={(e) => setCover(e.target.value)} placeholder="https://…" />
            </Field>
            <textarea className={textareaClass} value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Changes you want (for a rewrite)" />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={Boolean(busy)} onClick={() => run('approve', () => patch({ status: 'approved', coverImageUrl: cover || null, feedback: feedback || null }))}>
                Approve
              </Button>
              <Button size="sm" variant="secondary" disabled={Boolean(busy)} onClick={() => run('changes', () => patch({ status: 'changes', feedback }))}>
                Ask for changes
              </Button>
              <Button size="sm" variant="danger-ghost" disabled={Boolean(busy)} onClick={() => run('reject', () => patch({ status: 'rejected', feedback: feedback || null }))}>
                Reject
              </Button>
            </div>
          </div>
        )}

        {blog.status === 'approved' && canReview && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              disabled={Boolean(busy) || !storeConnected}
              onClick={() => {
                if (window.confirm('Publish this blog to the client’s Shopify store now? It goes live on their website.')) {
                  void run('publish', () => growthCall(`/blogs/${blog.id}/publish`, 'POST'));
                }
              }}
            >
              {busy === 'publish' ? 'Publishing…' : 'Publish to the store'}
            </Button>
            <span className="text-muted-foreground text-xs">Posts it to the store&apos;s first blog with the cover image.</span>
          </div>
        )}
        {blog.status === 'idea' && !blog.writeNext && (
          <Button size="sm" variant="ghost" className="self-start" onClick={() => run('next', () => patch({ writeNext: true }))}>
            Mark to write next
          </Button>
        )}
        {blog.writeNext && <p className="text-muted-foreground text-xs">Marked to be written next.</p>}
        <ErrorLine error={error} />
      </div>
    </details>
  );
}
