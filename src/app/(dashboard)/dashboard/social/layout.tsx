import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { getCurrentUser } from '@/modules/auth/server/session';
import { SocialShell } from '@/modules/social/components/shell/social-shell';
import { prisma } from '@/shared/lib/prisma';
import { getAccess } from '@/shared/server/access';
import { CLIENT_SCOPE_COOKIE, scopeFromAccess } from '@/shared/server/client-scope';

export default async function SocialLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  const ctx = await getAccess();
  const scope = scopeFromAccess(ctx, null, 'view');
  const clients = await prisma.socialCustomer.findMany({
    where: {
      organizationId: scope.organizationId,
      ...(scope.customerIds === 'all' ? {} : { id: { in: scope.customerIds } }),
    },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(CLIENT_SCOPE_COOKIE)?.value?.trim() || null;
  const allowed = new Set(clients.map((c) => c.id));
  const selectedClientId = fromCookie && allowed.has(fromCookie) ? fromCookie : null;

  return (
    <SocialShell
      userName={user.name}
      organizationName={user.organization.name}
      organizationSlug={user.organization.slug}
      initialClientScope={{ selectedClientId, clients }}
    >
      {children}
    </SocialShell>
  );
}
