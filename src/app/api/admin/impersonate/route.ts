import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { adminService } from '@/modules/admin/server/admin.service';
import { getCurrentUser } from '@/modules/auth/server/session';
import { errorResponse, HttpError } from '@/shared/server/http-error';

const startSchema = z.object({ userId: z.string().min(1) });

/** Start impersonation. Uses the real session user (not the swapped access context). */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user?.isPlatformAdmin) {
      throw new HttpError(404, 'Not found');
    }
    const body = startSchema.parse(await request.json());
    await adminService.impersonateUser(body.userId);
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}

/** Stop impersonation and clear the podo_impersonate cookie. */
export async function DELETE() {
  try {
    const user = await getCurrentUser();
    if (!user?.isPlatformAdmin) {
      throw new HttpError(404, 'Not found');
    }
    await adminService.stopImpersonating();
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
