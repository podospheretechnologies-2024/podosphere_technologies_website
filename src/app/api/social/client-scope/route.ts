import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/shared/lib/prisma';
import { getAccess } from '@/shared/server/access';
import {
  CLIENT_SCOPE_COOKIE,
  getClientScope,
  resolveSelectedClientId,
  scopeFromAccess,
} from '@/shared/server/client-scope';
import { errorResponse, HttpError } from '@/shared/server/http-error';

const CLIENT_SCOPE_MAX_AGE = 60 * 60 * 24 * 30;

const putSchema = z.object({
  clientId: z.string().min(1).nullable(),
});

async function listSwitcherClients() {
  const scope = await getClientScope('view', null);
  return prisma.socialCustomer.findMany({
    where: {
      organizationId: scope.organizationId,
      ...(scope.customerIds === 'all' ? {} : { id: { in: scope.customerIds } }),
    },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
}

/** Current switcher selection + clients the user may pick. */
export async function GET() {
  try {
    const [selectedClientId, clients] = await Promise.all([
      resolveSelectedClientId(),
      listSwitcherClients(),
    ]);
    // Drop a stale cookie value the user can no longer access.
    const allowedIds = new Set(clients.map((c) => c.id));
    const safeSelected =
      selectedClientId && allowedIds.has(selectedClientId) ? selectedClientId : null;
    if (selectedClientId && !safeSelected) {
      (await cookies()).delete(CLIENT_SCOPE_COOKIE);
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
      // Validate the pick the same way list routes will.
      scopeFromAccess(ctx, body.clientId, 'view');
    }

    const cookieStore = await cookies();
    if (body.clientId) {
      cookieStore.set(CLIENT_SCOPE_COOKIE, body.clientId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: CLIENT_SCOPE_MAX_AGE,
      });
    } else {
      cookieStore.delete(CLIENT_SCOPE_COOKIE);
    }

    const clients = await listSwitcherClients();
    return NextResponse.json({ selectedClientId: body.clientId, clients });
  } catch (error) {
    if (error instanceof HttpError) return errorResponse(error);
    return errorResponse(error);
  }
}
