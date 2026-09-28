import 'server-only';
import { jwtVerify, SignJWT } from 'jose';
import { cookies } from 'next/headers';
import { cache } from 'react';
import { getServerEnv } from '@/shared/lib/env';
import { prisma } from '@/shared/lib/prisma';

export const SESSION_COOKIE = 'podo_session';
const SESSION_DAYS = 7;

interface SessionPayload {
  uid: string;
  oid: string;
}

function secret() {
  return new TextEncoder().encode(getServerEnv().SESSION_SECRET);
}

export async function createSession(userId: string, organizationId: string): Promise<void> {
  const token = await new SignJWT({ uid: userId, oid: organizationId } satisfies SessionPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secret());

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function destroySession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

/** The signed-in user with their organization, or null. Cached per request. */
export const getCurrentUser = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) {
    return null;
  }

  try {
    const { payload } = await jwtVerify<SessionPayload>(token, secret(), { algorithms: ['HS256'] });
    return await prisma.user.findFirst({
      where: { id: payload.uid, organizationId: payload.oid, deletedAt: null },
      include: { organization: true },
    });
  } catch {
    return null;
  }
});

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;
