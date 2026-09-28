import type { ReactNode } from 'react';
import { socialNavigation } from '@/modules/social/config/navigation';
import { DashboardShell } from '@/shared/components/layout/dashboard-shell';

const dashboardSections = [socialNavigation];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <DashboardShell sections={dashboardSections}>{children}</DashboardShell>;
}
