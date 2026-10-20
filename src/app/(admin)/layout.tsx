import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { getCurrentUser } from '@/modules/auth/server/session';

/**
 * Platform-admin gate. Uses getCurrentUser (null) instead of getAccess (throws)
 * so unauthenticated visits go to /admin/login instead of a 500 page.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  let user;
  try {
    user = await getCurrentUser();
  } catch {
    redirect('/admin/login');
  }
  if (!user) {
    redirect('/admin/login');
  }
  if (!user.isPlatformAdmin) {
    redirect('/dashboard');
  }

  return children;
}
