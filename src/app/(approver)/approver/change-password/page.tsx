import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { ChangePortalPasswordForm } from '@/modules/auth/components/change-portal-password-form';
import { BrandedPortalShell } from '@/modules/social/components/shell/branded-portal-shell';
import { prisma } from '@/shared/lib/prisma';
import { brandingFromOrg, resolveOrgBranding } from '@/shared/server/org-branding';
import { getPortalSessionOrNull } from '@/shared/server/portal-session';

export const metadata = { title: 'Set password | Client Portal' };

export default async function ChangePortalPasswordPage() {
  const session = await getPortalSessionOrNull();
  const headerStore = await headers();
  const hostSlug = headerStore.get('x-podo-org-slug');
  const customDomain = headerStore.get('x-podo-custom-domain');

  if (!session) {
    redirect('/login');
  }

  if (!session.mustChangePassword) {
    redirect('/portal');
  }

  const organization = await prisma.organization.findUnique({
    where: { id: session.organizationId },
    select: { name: true, slug: true, logoUrl: true, primaryColor: true, portalTitle: true },
  });
  const branding = organization
    ? brandingFromOrg(organization)
    : ((await resolveOrgBranding({ slug: hostSlug, customDomain })) ??
      brandingFromOrg({ name: 'Client Portal', slug: 'portal' }));

  return (
    <BrandedPortalShell branding={branding}>
      <div className="mx-auto max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-gray-900">Set your own password</h1>
        <p className="mt-1 mb-6 text-sm text-gray-500">
          Your agency gave you a temporary password. Choose a new one before opening the portal.
        </p>
        <ChangePortalPasswordForm requireCurrent={false} />
      </div>
    </BrandedPortalShell>
  );
}
