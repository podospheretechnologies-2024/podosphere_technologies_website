import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { UserMenu } from '@/modules/auth/components/user-menu';
import { getCurrentUser } from '@/modules/auth/server/session';
import { socialNavigation } from '@/modules/social/config/navigation';
import { DashboardShell } from '@/shared/components/layout/dashboard-shell';

const dashboardSections = [socialNavigation];

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  return (
    <DashboardShell
      sections={dashboardSections}
      footer={<UserMenu name={user.name} organizationName={user.organization.name} />}
    >
      {children}
    </DashboardShell>
  );
}
