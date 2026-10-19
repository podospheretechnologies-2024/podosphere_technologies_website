/** Typed in-app / email notifications (SOCIAL_PENDING F12 + B2). */
export const SOCIAL_NOTIFICATION_TYPES = [
  'approval_needed',
  'post_failed',
  'token_expired',
  'sla_breached',
  'budget_80',
  'new_lead',
  /** Legacy / uncategorised alerts from the hourly rules runner. */
  'alert',
] as const;

export type SocialNotificationType = (typeof SOCIAL_NOTIFICATION_TYPES)[number];

export const NOTIFICATION_TYPE_LABELS: Record<SocialNotificationType, string> = {
  approval_needed: 'Approval needed',
  post_failed: 'Post failed',
  token_expired: 'Token expired',
  sla_breached: 'SLA breached',
  budget_80: 'Budget at 80%',
  new_lead: 'New lead',
  alert: 'Alert',
};
