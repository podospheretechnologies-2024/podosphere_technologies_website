/**
 * What a MEMBER may do on a client they are assigned to (SocialClientMember.permissions).
 * Mirrors `ClientPermission` in `shared/server/access.ts`; kept here so the Team page can import it.
 */
export const CLIENT_PERMISSIONS = [
  { id: 'view', label: 'View' },
  { id: 'draft', label: 'Draft posts' },
  { id: 'publish', label: 'Schedule / publish' },
  { id: 'approve', label: 'Approvals' },
  { id: 'inbox', label: 'Inbox' },
  { id: 'leads', label: 'Leads' },
  { id: 'reports', label: 'Reports' },
  { id: 'ads_view', label: 'View ads' },
  { id: 'ads_manage', label: 'Manage ads' },
] as const;

export type ClientPermissionId = (typeof CLIENT_PERMISSIONS)[number]['id'];

export const CLIENT_PERMISSION_IDS = CLIENT_PERMISSIONS.map((p) => p.id) as [ClientPermissionId, ...ClientPermissionId[]];

/** Ticked by default when a client is given to a member: day-to-day work, no publishing or ad changes. */
export const DEFAULT_MEMBER_PERMISSIONS: ClientPermissionId[] = ['view', 'draft', 'inbox', 'leads', 'reports', 'ads_view'];

export interface ClientAccessEntry {
  customerId: string;
  permissions: ClientPermissionId[];
}
