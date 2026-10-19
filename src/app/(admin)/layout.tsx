import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { getAccess } from '@/shared/server/access';
import { HttpError } from '@/shared/server/http-error';

/** Auth gate for platform admin. Mirrors dashboard: 401 → login, not a 500 page. */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  try {
    const ctx = await getAccess();
    if (!ctx.isPlatformAdmin) {
      redirect('/dashboard');
    }
  } catch (error) {
    if (error instanceof HttpError && error.status === 401) {
      redirect('/login');
    }
    throw error;
  }

  return children;
}
