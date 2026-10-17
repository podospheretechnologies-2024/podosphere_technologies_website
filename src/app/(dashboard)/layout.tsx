import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { ImpersonationBanner } from '@/modules/admin/components/impersonation-banner';
import { getAccess } from '@/shared/server/access';
import { HttpError } from '@/shared/server/http-error';

/** Auth gate + impersonation banner. Social pages own their Postiz-style shell. */
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  let impersonating: { name: string; org: string } | null = null;
  try {
    const ctx = await getAccess();
    if (ctx.impersonatedBy) {
      impersonating = { name: ctx.user.name, org: ctx.organization.name };
    }
  } catch (error) {
    if (error instanceof HttpError && error.status === 401) {
      redirect('/login');
    }
    throw error;
  }

  return (
    <>
      {impersonating ? (
        <ImpersonationBanner
          viewingAsName={impersonating.name}
          viewingAsOrg={impersonating.org}
        />
      ) : null}
      {children}
    </>
  );
}
