import { NextResponse, type NextRequest } from 'next/server';

const SESSION_COOKIE = 'podo_session';
/** Mirrors `CLIENT_SCOPE_COOKIE` in client-scope.ts (proxy cannot import server-only). */
const CLIENT_SCOPE_COOKIE = 'podo_client';
const CLIENT_SCOPE_MAX_AGE = 60 * 60 * 24 * 30;

/** Platform apex from APP_URL — mirrors `platformRootHost` in org-branding.ts (keep inline). */
function platformRootHost(): string | null {
  const raw = process.env.APP_URL;
  if (!raw) return null;
  try {
    return new URL(raw).hostname.toLowerCase().replace(/^www\./, '') || null;
  } catch {
    return null;
  }
}

/** Subdomain → agency slug for white-label (mirrors `orgSlugFromHost`; keep inline — no server-only import). */
function orgSlugFromHost(host: string | null): string | null {
  if (!host) return null;
  const hostname = host.split(':')[0]?.toLowerCase() ?? '';
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost')) return null;

  const root = platformRootHost();
  if (root) {
    if (hostname === root || hostname === `www.${root}`) return null;
    if (!hostname.endsWith(`.${root}`)) return null;
    const sub = hostname.slice(0, -(root.length + 1));
    if (!sub || sub.includes('.') || sub === 'www' || sub === 'app' || sub === 'api') return null;
    return sub;
  }

  const parts = hostname.split('.');
  if (parts.length < 3) return null;
  const slug = parts[0];
  if (!slug || slug === 'www' || slug === 'app' || slug === 'api') return null;
  return slug;
}

/** Non-platform host → candidate custom domain (mirrors `customDomainFromHost`; DB confirms later). */
function customDomainFromHost(host: string | null): string | null {
  if (!host) return null;
  const hostname = host.split(':')[0]?.toLowerCase() ?? '';
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost')) return null;
  if (orgSlugFromHost(host)) return null;
  const root = platformRootHost();
  if (root && (hostname === root || hostname === `www.${root}`)) return null;
  if (!hostname.includes('.')) return null;
  return hostname;
}

// Optimistic redirect only (is there a session cookie at all?). The real check is
// getCurrentUser() on the server, which verifies the signed session.
// When `?client=` is present, persist it on `podo_client` and expose it as `x-podo-client`
// so `getClientScope` sees the pick on the same request.
// White-label: `{slug}.host` → `x-podo-org-slug`; custom domain → `x-podo-custom-domain`.
export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isDashboard = path.startsWith('/dashboard');
  const isApprover = path.startsWith('/approver');

  if (isDashboard && !request.cookies.has(SESSION_COOKIE)) {
    const url = new URL('/login', request.url);
    url.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  const requestHeaders = new Headers(request.headers);
  const host = request.headers.get('host');

  const brandSlug = orgSlugFromHost(host);
  if (brandSlug) {
    requestHeaders.set('x-podo-org-slug', brandSlug);
  } else {
    const customDomain = customDomainFromHost(host);
    if (customDomain) {
      requestHeaders.set('x-podo-custom-domain', customDomain);
    }
  }

  if (isDashboard) {
    const clientParam = request.nextUrl.searchParams.get('client');
    if (clientParam !== null) {
      requestHeaders.set('x-podo-client', clientParam);
    }

    const response = NextResponse.next({ request: { headers: requestHeaders } });

    if (clientParam !== null) {
      const trimmed = clientParam.trim();
      if (trimmed) {
        response.cookies.set(CLIENT_SCOPE_COOKIE, trimmed, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: CLIENT_SCOPE_MAX_AGE,
        });
      } else {
        response.cookies.delete(CLIENT_SCOPE_COOKIE);
      }
    }

    return response;
  }

  if (isApprover) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ['/dashboard/:path*', '/approver/:path*'],
};
