import 'server-only';
import { requirePortalSessionReady } from '@/shared/server/portal-session';
import type { PortalSession } from '../approvals/approval.service';
import type { PortalTabId } from '../../config/portal-tabs';
import { portalTabsService } from './portal-tabs.service';

/**
 * One guard for every client-portal API route: a logged-in client whose agency has switched this
 * tab on at the needed level. Use `view` for reads and `act` for anything that changes data.
 * Client and organization always come from the session cookie, never from the request.
 */
export async function requirePortalTab(
  tabId: PortalTabId,
  need: 'view' | 'act'
): Promise<PortalSession> {
  const session = await requirePortalSessionReady();
  await portalTabsService.requireLevel(session.organizationId, session.customerId, tabId, need);
  return session;
}
