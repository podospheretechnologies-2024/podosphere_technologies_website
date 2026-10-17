export interface AgencyOverview {
  postsDue: number;
  drafts: number;
  leads: number;
  inboxWaiting: number;
  syncErrors: number;
  spend30d: number | null;
  followers: number | null;
  clients: number;
}
