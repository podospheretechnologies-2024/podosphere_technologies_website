import 'server-only';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { prisma } from '@/shared/lib/prisma';
import { brandingFromOrg, resolveOrgBranding, type OrgBranding } from '@/shared/server/org-branding';
import { getPortalSessionOrNull } from '@/shared/server/portal-session';
import {
  PORTAL_BASE_PATH,
  type PortalTabDefinition,
  type PortalTabId,
} from '../../config/portal-tabs';
import type { PortalNavItem } from '../../components/shell/portal-shell';
import { portalTabsService } from './portal-tabs.service';

export type PortalPageContext = {
  organizationId: string;
  customerId: string;
  approverId: string;
  branding: OrgBranding;
  tabs: PortalTabDefinition[];
  nav: PortalNavItem[];
};

export async function requirePortalPage(tabId?: PortalTabId): Promise<PortalPageContext> {
  const session = await getPortalSessionOrNull();
  const headerStore = await headers();
  const hostSlug = headerStore.get('x-podo-org-slug');
  const customDomain = headerStore.get('x-podo-custom-domain');

  if (!session) {
    redirect('/login');
  }
  if (session.mustChangePassword && !session.agencyPreview) {
    redirect('/approver/change-password');
  }

  const [organization, tabs] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: session.organizationId },
      select: { name: true, slug: true, logoUrl: true, primaryColor: true, portalTitle: true },
    }),
    portalTabsService.listEnabledTabs(session.organizationId, session.customerId),
  ]);

  const branding = organization
    ? brandingFromOrg(organization)
    : ((await resolveOrgBranding({ slug: hostSlug, customDomain })) ??
      brandingFromOrg({ name: 'Client Portal', slug: 'portal' }));

  if (tabs.length === 0) {
    // Should not happen — channels/content always default on — but stay safe.
    redirect('/login');
  }

  if (tabId && !tabs.some((tab) => tab.id === tabId)) {
    redirect(tabs[0]!.href);
  }

  const nav: PortalNavItem[] = tabs.map((tab) => ({
    id: tab.id,
    label: tab.label,
    href: tab.href,
  }));

  return {
    organizationId: session.organizationId,
    customerId: session.customerId,
    approverId: session.approverId,
    branding,
    tabs,
    nav,
  };
}

export function portalHomeHref(tabs: PortalTabDefinition[]): string {
  return tabs[0]?.href ?? `${PORTAL_BASE_PATH}/overview`;
}
