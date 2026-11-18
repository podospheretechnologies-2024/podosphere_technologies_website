import type { PortalPlugsSummary } from '@/modules/social/server/portal/portal-plugs.service';

const MATCH_LABELS: Record<string, string> = {
  keyword: 'Keyword',
  regex: 'Regex',
};

const REPLY_LABELS: Record<string, string> = {
  text: 'Text reply',
  template: 'Template reply',
};

export function PortalPlugsPanel({ data }: { data: PortalPlugsSummary }) {
  const empty = data.autoReplies.length === 0 && data.autoPosts.length === 0;

  return (
    <>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-foreground">Plugs</h2>
        <p className="mt-1 text-muted-foreground">
          Automation rules linked to your brand. Read-only — ask your agency to change them.
        </p>
      </div>

      {empty ? (
        <div className="rounded-xl border border-border bg-surface p-12 text-center text-muted-foreground">
          No plugs set up for your brand yet.
        </div>
      ) : (
        <div className="space-y-8">
          <section>
            <h3 className="mb-3 text-lg font-semibold text-foreground">WhatsApp auto-replies</h3>
            {data.autoReplies.length === 0 ? (
              <div className="rounded-xl border border-border bg-surface p-8 text-center text-sm text-muted-foreground">
                No auto-reply rules for your brand.
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {data.autoReplies.map((rule) => (
                  <article
                    key={rule.id}
                    className="rounded-xl border border-border bg-surface p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{rule.name}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {MATCH_LABELS[rule.matchType] ?? rule.matchType}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                          rule.active
                            ? 'bg-emerald-50 text-emerald-800'
                            : 'bg-surface-muted text-muted-foreground'
                        }`}
                      >
                        {rule.active ? 'Active' : 'Off'}
                      </span>
                    </div>
                    <p className="mt-3 break-all rounded-lg bg-surface-muted px-3 py-2 font-mono text-xs text-foreground">
                      {rule.pattern}
                    </p>
                    <p className="mt-3 text-xs text-muted-foreground">
                      {REPLY_LABELS[rule.replyType] ?? rule.replyType}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section>
            <h3 className="mb-3 text-lg font-semibold text-foreground">Auto posts</h3>
            {data.autoPosts.length === 0 ? (
              <div className="rounded-xl border border-border bg-surface p-8 text-center text-sm text-muted-foreground">
                No auto-post rules for your brand.
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {data.autoPosts.map((post) => (
                  <article
                    key={post.id}
                    className="rounded-xl border border-border bg-surface p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="truncate text-sm font-semibold text-foreground">{post.title}</p>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                          post.active
                            ? 'bg-emerald-50 text-emerald-800'
                            : 'bg-surface-muted text-muted-foreground'
                        }`}
                      >
                        {post.active ? 'Active' : 'Off'}
                      </span>
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">Feed auto-post</p>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}
