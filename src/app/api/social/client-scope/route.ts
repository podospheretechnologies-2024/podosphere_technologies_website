import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/shared/lib/prisma';
import { getAccess } from '@/shared/server/access';
import {
  CLIENT_SCOPE_COOKIE,
  listableClientIds,
  pinSelectedClientId,
  resolveSelectedClientId,
  scopeFromAccess,
} from '@/shared/server/client-scope';
import { errorResponse, HttpError } from '@/shared/server/http-error';

const CLIENT_SCOPE_MAX_AGE = 60 * 60 * 24 * 30;

const putSchema = z.object({
  clientId: z.string().min(1).nullable(),
});

async function listSwitcherClients() {
  const ctx = await getAccess();
  const listable = listableClientIds(ctx, 'view');
  return prisma.socialCustomer.findMany({
    where: {
      organizationId: ctx.organization.id,
      ...(listable === 'all' ? {} : { id: { in: listable } }),
    },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
}

function writeClientCookie(
  cookieStore: Awaited<ReturnType<typeof cookies>>,
  clientId: string | null
) {
  if (clientId) {
    cookieStore.set(CLIENT_SCOPE_COOKIE, clientId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: CLIENT_SCOPE_MAX_AGE,
    });
    return;
  }
  cookieStore.delete(CLIENT_SCOPE_COOKIE);
}

/** Current switcher selection + clients the user may pick. */
export async function GET() {
  try {
    const [selectedClientId, clients, ctx] = await Promise.all([
      resolveSelectedClientId(),
      listSwitcherClients(),
      getAccess(),
    ]);
    const safeSelected = pinSelectedClientId(ctx.role, clients, selectedClientId);
    const cookieStore = await cookies();
    if (safeSelected && safeSelected !== selectedClientId) {
      writeClientCookie(cookieStore, safeSelected);
    } else if (selectedClientId && !safeSelected) {
      cookieStore.delete(CLIENT_SCOPE_COOKIE);
    }
    return NextResponse.json({ selectedClientId: safeSelected, clients });
  } catch (error) {
    return errorResponse(error);
  }
}

/** Set or clear the `podo_client` httpOnly cookie. */
export async function PUT(request: Request) {
  try {
    const body = putSchema.parse(await request.json());
    const ctx = await getAccess();

    if (body.clientId) {
      scopeFromAccess(ctx, body.clientId, 'view');
    } else if (ctx.role === 'MEMBER') {
      throw new HttpError(400, 'Pick a client. Client users cannot switch to All clients.');
    }

    const clients = await listSwitcherClients();
    const selectedClientId = pinSelectedClientId(ctx.role, clients, body.clientId);
    writeClientCookie(await cookies(), selectedClientId);
    return NextResponse.json({ selectedClientId, clients });
  } catch (error) {
    if (error instanceof HttpError) return errorResponse(error);
    return errorResponse(error);
  }
}
