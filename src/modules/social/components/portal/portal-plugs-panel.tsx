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
        <h2 className="text-2xl font-bold text-gray-900">Plugs</h2>
        <p className="mt-1 text-gray-500">
          Automation rules linked to your brand. Read-only — ask your agency to change them.
        </p>
      </div>

      {empty ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-gray-500">
          No plugs set up for your brand yet.
        </div>
      ) : (
        <div className="space-y-8">
          <section>
            <h3 className="mb-3 text-lg font-semibold text-gray-900">WhatsApp auto-replies</h3>
            {data.autoReplies.length === 0 ? (
              <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
                No auto-reply rules for your brand.
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {data.autoReplies.map((rule) => (
                  <article
                    key={rule.id}
                    className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-gray-900">{rule.name}</p>
                        <p className="mt-0.5 text-xs text-gray-500">
                          {MATCH_LABELS[rule.matchType] ?? rule.matchType}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                          rule.active
                            ? 'bg-emerald-50 text-emerald-800'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {rule.active ? 'Active' : 'Off'}
                      </span>
                    </div>
                    <p className="mt-3 break-all rounded-lg bg-gray-50 px-3 py-2 font-mono text-xs text-gray-700">
                      {rule.pattern}
                    </p>
                    <p className="mt-3 text-xs text-gray-500">
                      {REPLY_LABELS[rule.replyType] ?? rule.replyType}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section>
            <h3 className="mb-3 text-lg font-semibold text-gray-900">Auto posts</h3>
            {data.autoPosts.length === 0 ? (
              <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
                No auto-post rules for your brand.
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {data.autoPosts.map((post) => (
                  <article
                    key={post.id}
                    className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="truncate text-sm font-semibold text-gray-900">{post.title}</p>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                          post.active
                            ? 'bg-emerald-50 text-emerald-800'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {post.active ? 'Active' : 'Off'}
                      </span>
                    </div>
                    <p className="mt-3 text-xs text-gray-500">Feed auto-post</p>
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
