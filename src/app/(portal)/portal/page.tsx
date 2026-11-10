import { redirect } from 'next/navigation';
import { portalHomeHref, requirePortalPage } from '@/modules/social/server/portal/portal-page';

export default async function PortalIndexPage() {
  const ctx = await requirePortalPage();
  redirect(portalHomeHref(ctx.tabs));
}
