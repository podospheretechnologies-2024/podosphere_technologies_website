import type { NextRequest } from 'next/server';
import { orgExistsForCustomDomain } from '@/shared/server/org-branding';

/**
 * Caddy on-demand TLS ask endpoint.
 * Public: returns 200 only when the queried hostname matches an org `customDomain`.
 * Caddy calls this as: GET /api/caddy/ask?domain=portal.example.com
 */
export async function GET(request: NextRequest) {
  const domain =
    request.nextUrl.searchParams.get('domain') ??
    request.nextUrl.searchParams.get('host') ??
    '';

  if (!domain.trim()) {
    return new Response(null, { status: 404 });
  }

  const ok = await orgExistsForCustomDomain(domain);
  return new Response(null, { status: ok ? 200 : 404 });
}
