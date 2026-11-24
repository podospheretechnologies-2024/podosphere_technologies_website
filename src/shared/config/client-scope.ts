/** Switcher / cookie value for the admin-only Unassigned bucket (`customerId = null`). */
export const UNASSIGNED_CLIENT_SCOPE = 'unassigned' as const;

export type UnassignedClientScope = typeof UNASSIGNED_CLIENT_SCOPE;
