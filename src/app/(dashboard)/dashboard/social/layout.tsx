import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/modules/auth/server/session';
import { SocialShell } from '@/modules/social/components/shell/social-shell';

export default async function SocialLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  return (
    <SocialShell userName={user.name} organizationName={user.organization.name}>
      {children}
    </SocialShell>
  );
}
