import type { NextRequest } from 'next/server';
import { loginSchema } from '@/modules/auth/server/auth.schema';
import { authService, toCurrentUserItem } from '@/modules/auth/server/auth.service';
import { createSession } from '@/modules/auth/server/session';
import { errorResponse } from '@/shared/server/http-error';

export async function POST(request: NextRequest) {
  try {
    const body = loginSchema.parse(await request.json());
    const user = await authService.login(body);
    await createSession(user.id, user.organizationId);
    return Response.json(toCurrentUserItem(user));
  } catch (error) {
    return errorResponse(error);
  }
}
