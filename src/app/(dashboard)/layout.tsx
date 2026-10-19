import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { ImpersonationBanner } from '@/modules/admin/components/impersonation-banner';
import { getCurrentUser } from '@/modules/auth/server/session';
import { getAccess } from '@/shared/server/access';

/** Auth gate + impersonation banner. Social pages own their Postiz-style shell. */
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  // Soft null check — avoid thrown HttpError 401 becoming a 500 HTML page.
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  let impersonating: { name: string; org: string } | null = null;
  const ctx = await getAccess();
  if (ctx.impersonatedBy) {
    impersonating = { name: ctx.user.name, org: ctx.organization.name };
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
