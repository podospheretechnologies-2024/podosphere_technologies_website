import { NextResponse, type NextRequest } from 'next/server';

const SESSION_COOKIE = 'podo_session';

// Optimistic redirect only (is there a session cookie at all?). The real check is
// getCurrentUser() on the server, which verifies the signed session.
export function proxy(request: NextRequest) {
  if (!request.cookies.has(SESSION_COOKIE)) {
    const url = new URL('/login', request.url);
    url.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*'],
};
