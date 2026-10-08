import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'API docs' };

export default function ApiDocsPage() {
  return (
    <article className="mx-auto max-w-3xl px-6 pt-32 pb-20">
      <h1 className="text-3xl font-semibold">Podo Social API</h1>
      <p className="text-muted-foreground mt-3 text-sm">Send <code>Authorization: Bearer ps_live_…</code> on every request.</p>
      <ul className="mt-8 space-y-4 text-sm">
        <li><code>POST /api/v1/posts</code> — posts:write. Body: integrationId, content, optional publishAt.</li>
        <li><code>GET /api/v1/analytics</code> — analytics:read. Last 30 days of post counts.</li>
        <li><code>GET /api/v1/leads</code> — leads:read.</li>
        <li><code>POST /api/v1/whatsapp/send</code> — whatsapp:send. Body matches the dashboard send API.</li>
      </ul>
    </article>
  );
}
