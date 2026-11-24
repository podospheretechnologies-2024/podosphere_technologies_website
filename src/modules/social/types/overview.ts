export interface AgencyOverview {
  postsDue: number;
  drafts: number;
  leads: number;
  inboxWaiting: number;
  syncErrors: number;
  spend30d: number | null;
  followers: number | null;
  clients: number;
  /**
   * Only under "All clients" (OWNER/ADMIN): channels not mapped to any client. Never part of the
   * totals above (rule R3).
   */
  unassigned?: { channels: number; followers: number | null } | null;
}
