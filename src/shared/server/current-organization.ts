import 'server-only';
import type { Organization } from '@/generated/prisma/client';
import { getCurrentUser } from '@/modules/auth/server/session';
import { HttpError } from './http-error';

// Every request belongs to the signed-in user's organization. Route handlers and
// pages call this; without a valid session it throws 401 (API) / the dashboard
// layout redirects to /login first (pages).
export async function getCurrentOrganization(): Promise<Organization> {
  const user = await getCurrentUser();
  if (!user) {
    throw new HttpError(401, 'Please log in');
  }
  return user.organization;
}
