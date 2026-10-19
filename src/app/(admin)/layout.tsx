import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { getCurrentUser } from '@/modules/auth/server/session';

/**
 * Platform-admin gate. Uses getCurrentUser (null) instead of getAccess (throws)
 * so unauthenticated visits redirect to /login instead of a 500 page.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }
  if (!user.isPlatformAdmin) {
    redirect('/dashboard');
  }

  return children;
}
