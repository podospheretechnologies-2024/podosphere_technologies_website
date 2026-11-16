import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { CodeBlock } from '@/modules/marketing/components/code-block';
import { API_BASE_URL, SITE_URL } from '@/modules/marketing/config/site';

export const metadata: Metadata = {
  title: 'API docs',
  description:
    'Podo Social public API: Bearer ps_live_ keys, posts, analytics, leads and WhatsApp send. Agency Pro plan.',
  alternates: { canonical: `${SITE_URL}/docs/api` },
};

const NAV = [
  { href: '#overview', label: 'Overview' },
  { href: '#auth', label: 'Auth' },
  { href: '#permissions', label: 'Permissions' },
  { href: '#endpoints', label: 'Endpoints' },
  { href: '#webhooks', label: 'Webhooks' },
  { href: '#errors', label: 'Errors' },
  { href: '#changelog', label: 'Changelog' },
] as const;

const curlPost = `curl -X POST ${API_BASE_URL}/posts \\
  -H "Authorization: Bearer ps_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"integrationId":"int_123","content":"Diwali sale is live","publishAt":"2026-11-20T13:30:00.000Z"}'`;

const nodePost = `const res = await fetch("${API_BASE_URL}/posts", {
  method: "POST",
  headers: {
    Authorization: "Bearer ps_live_xxx",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    integrationId: "int_123",
    content: "Diwali sale is live",
    publishAt: "2026-11-20T13:30:00.000Z",
  }),
});
const data = await res.json();`;

const pythonPost = `import requests

r = requests.post(
    "${API_BASE_URL}/posts",
    headers={"Authorization": "Bearer ps_live_xxx"},
    json={
        "integrationId": "int_123",
        "content": "Diwali sale is live",
        "publishAt": "2026-11-20T13:30:00.000Z",
    },
)
print(r.status_code, r.json())`;

const curlWhatsApp = `curl -X POST ${API_BASE_URL}/whatsapp/send \\
  -H "Authorization: Bearer ps_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"type":"text","to":"919876543210","text":"Your order is confirmed"}'`;

export default function ApiDocsPage() {
  return (
    <div className="mx-auto flex max-w-6xl gap-10 px-6 pt-32 pb-24">
      <aside className="sticky top-28 hidden w-44 shrink-0 self-start lg:block">
        <p className="text-xs font-semibold tracking-wide text-[#8A8A8A] uppercase">API</p>
        <nav className="mt-4 space-y-1 text-sm">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-muted-foreground hover:text-foreground block rounded-lg px-2 py-1.5"
            >
              {item.label}
            </a>
          ))}
        </nav>
      </aside>

      <article className="min-w-0 flex-1 space-y-16">
        <header id="overview">
          <h1 className="text-4xl font-semibold tracking-tight">Podo Social API</h1>
          <p className="text-muted-foreground mt-4 max-w-2xl text-base leading-relaxed">
            Programmatic access for Agency Pro workspaces. Create a key in{' '}
            <strong>Dashboard → Social → API</strong> (shown once). Keys belong to one organisation
            and can be limited to a single client.
          </p>
          <dl className="border-border mt-8 grid gap-4 rounded-2xl border bg-surface p-5 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Base URL</dt>
              <dd className="mt-1 font-mono text-xs break-all">{API_BASE_URL}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Auth header</dt>
              <dd className="mt-1 font-mono text-xs">Authorization: Bearer ps_live_…</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Plan</dt>
              <dd className="mt-1">Agency Pro (`api` feature in plans)</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Controls</dt>
              <dd className="mt-1">Permissions · IP allowlist · daily request limit · call log</dd>
            </div>
          </dl>
        </header>

        <section id="auth" className="space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">Auth</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Send the Bearer token on every request. Revoked or missing keys return 401. Keys that
            fail the IP allowlist or lack a permission return 403. Daily limits reset at UTC
            midnight (429). `lastUsedAt` updates in the dashboard after each call.
          </p>
        </section>

        <section id="permissions" className="space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">Permissions</h2>
          <div className="border-border overflow-x-auto rounded-xl border">
            <table className="min-w-full text-sm">
              <thead className="bg-surface-muted/60 text-left text-xs uppercase">
                <tr>
                  <th className="px-4 py-3">Permission</th>
                  <th className="px-4 py-3">Endpoint</th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                <tr>
                  <td className="px-4 py-3 font-mono text-xs">posts:write</td>
                  <td className="px-4 py-3 font-mono text-xs">POST /posts</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono text-xs">analytics:read</td>
                  <td className="px-4 py-3 font-mono text-xs">GET /analytics</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono text-xs">leads:read</td>
                  <td className="px-4 py-3 font-mono text-xs">GET /leads</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono text-xs">whatsapp:send</td>
                  <td className="px-4 py-3 font-mono text-xs">POST /whatsapp/send</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section id="endpoints" className="space-y-12">
          <h2 className="text-2xl font-semibold tracking-tight">Endpoints</h2>

          <Endpoint
            method="POST"
            path="/posts"
            permission="posts:write"
            summary="Creates a draft, or schedules it when publishAt is set. Returns 201 with the created post group."
          >
            <FieldTable
              rows={[
                ['integrationId', 'string', 'yes', 'Channel id from Dashboard → Channels'],
                ['content', 'string', 'yes', '1–10,000 characters'],
                ['publishAt', 'ISO date string', 'no', 'Omitted = draft'],
              ]}
            />
            <div className="mt-4 space-y-3">
              <CodeBlock label="curl" code={curlPost} />
              <CodeBlock label="Node (fetch)" code={nodePost} />
              <CodeBlock label="Python (requests)" code={pythonPost} />
            </div>
            <p className="text-muted-foreground mt-3 text-xs">
              Sample response shape matches the dashboard create-post payload (group + posts). Call
              staging once and paste the exact JSON here before launch if you need a frozen
              example.
            </p>
          </Endpoint>

          <Endpoint
            method="GET"
            path="/analytics"
            permission="analytics:read"
            summary="Post counts for the last 30 days, scoped to the key’s organisation (and client, if limited)."
          />

          <Endpoint
            method="GET"
            path="/leads"
            permission="leads:read"
            summary="Leads list — same data as the Leads page, scoped to the key."
          />

          <Endpoint
            method="POST"
            path="/whatsapp/send"
            permission="whatsapp:send"
            summary="Sends a WhatsApp message. Body matches the dashboard send API (discriminated union on type)."
          >
            <FieldTable
              rows={[
                ['type', '"text" | "template"', 'yes', 'Message kind'],
                ['to', 'string', 'yes', 'E.164 digits, e.g. 919876543210'],
                ['text', 'string', 'if text', 'Body when type=text'],
                ['templateName', 'string', 'if template', 'Approved template name'],
                ['language', 'string', 'if template', 'Template language code'],
                ['variables', 'string[]', 'no', 'Template variables (default [])'],
              ]}
            />
            <div className="mt-4">
              <CodeBlock label="curl (text)" code={curlWhatsApp} />
            </div>
          </Endpoint>
        </section>

        <section id="webhooks" className="space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">Outgoing webhooks</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Configure in Dashboard → Automation. Subscribe to publish and related events, inspect
            the payload, and use the in-app test button. Public short links live at{' '}
            <code className="text-foreground">/l/[code]</code>; bio pages at{' '}
            <code className="text-foreground">/b/[slug]</code>.
          </p>
          <Link href="/features/automation" className="text-primary text-sm font-medium">
            Automation features →
          </Link>
        </section>

        <section id="errors" className="space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">Errors & limits</h2>
          <div className="border-border overflow-x-auto rounded-xl border">
            <table className="min-w-full text-sm">
              <thead className="bg-surface-muted/60 text-left text-xs uppercase">
                <tr>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Meaning</th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                <tr>
                  <td className="px-4 py-3 font-mono text-xs">401</td>
                  <td className="px-4 py-3">Missing API key / key invalid or revoked</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono text-xs">403</td>
                  <td className="px-4 py-3">Key lacks the permission, or IP not in allowlist</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono text-xs">429</td>
                  <td className="px-4 py-3">Daily API limit reached (resets at UTC midnight)</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono text-xs">4xx</td>
                  <td className="px-4 py-3">Validation error (zod); message names the field</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section id="changelog" className="space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">Changelog</h2>
          <ul className="text-muted-foreground list-disc space-y-2 pl-5 text-sm">
            <li>
              <strong className="text-foreground">2026-11</strong> — Documented posts, analytics,
              leads and WhatsApp send for Agency Pro.
            </li>
          </ul>
        </section>
      </article>
    </div>
  );
}

function Endpoint({
  method,
  path,
  permission,
  summary,
  children,
}: {
  method: string;
  path: string;
  permission: string;
  summary: string;
  children?: ReactNode;
}) {
  return (
    <div className="border-border rounded-2xl border bg-surface p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-md bg-[#111111] px-2 py-0.5 font-mono text-xs text-white">
          {method}
        </span>
        <code className="text-sm font-semibold">{path}</code>
        <span className="text-muted-foreground font-mono text-xs">{permission}</span>
      </div>
      <p className="text-muted-foreground mt-3 text-sm leading-relaxed">{summary}</p>
      {children}
    </div>
  );
}

function FieldTable({
  rows,
}: {
  rows: [string, string, string, string][];
}) {
  return (
    <div className="border-border mt-4 overflow-x-auto rounded-xl border">
      <table className="min-w-full text-sm">
        <thead className="bg-surface-muted/60 text-left text-xs uppercase">
          <tr>
            <th className="px-3 py-2">Field</th>
            <th className="px-3 py-2">Type</th>
            <th className="px-3 py-2">Required</th>
            <th className="px-3 py-2">Notes</th>
          </tr>
        </thead>
        <tbody className="divide-border divide-y">
          {rows.map(([field, type, req, notes]) => (
            <tr key={field}>
              <td className="px-3 py-2 font-mono text-xs">{field}</td>
              <td className="px-3 py-2 text-xs">{type}</td>
              <td className="px-3 py-2 text-xs">{req}</td>
              <td className="text-muted-foreground px-3 py-2 text-xs">{notes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
