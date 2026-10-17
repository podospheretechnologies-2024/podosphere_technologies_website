import 'server-only';
import { cookies, headers } from 'next/headers';
import { getAccess, type AccessContext, type ClientPermission } from './access';
import { HttpError } from './http-error';

/** httpOnly cookie set by the client switcher; read by `getClientScope`. */
export const CLIENT_SCOPE_COOKIE = 'podo_client';

/**
 * The set of clients a request may read, inside one organization (PODO_SOCIAL_CLIENT_PLAN.md 4.3).
 * `organizationId` is the tenant boundary; `customerIds` is the client boundary inside it.
 */
export interface ClientScope {
  organizationId: string;
  /** 'all' = every client of the organization (OWNER/ADMIN with no client picked). */
  customerIds: 'all' | string[];
}

/**
 * Pure: builds the scope from an already-loaded access context.
 * `selectedClientId` is the client picked in the switcher (cookie or `?client=`). A MEMBER only gets the
 * clients where they hold `permission`; asking for any other client gives 404, the same as `requireClient()`.
 */
export function scopeFromAccess(
  ctx: AccessContext,
  selectedClientId?: string | null,
  permission: ClientPermission = 'view'
): ClientScope {
  const organizationId = ctx.organization.id;
  const allowed = ctx.clientIds === 'all' ? 'all' : ctx.clientIds.filter((id) => ctx.can(permission, id));

  if (selectedClientId) {
    if (allowed !== 'all' && !allowed.includes(selectedClientId)) {
      throw new HttpError(404, 'Not found');
    }
    return { organizationId, customerIds: [selectedClientId] };
  }
  return { organizationId, customerIds: allowed };
}

/**
 * Resolves the switcher selection: optional `?client=` (via `x-podo-client` from proxy), else `podo_client` cookie.
 * Empty / missing means "All clients" (no narrow).
 */
export async function resolveSelectedClientId(): Promise<string | null> {
  const headerStore = await headers();
  const fromQuery = headerStore.get('x-podo-client');
  if (fromQuery !== null) {
    const trimmed = fromQuery.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(CLIENT_SCOPE_COOKIE)?.value?.trim();
  return fromCookie && fromCookie.length > 0 ? fromCookie : null;
}

/** Request-time helper for route handlers. Workers and webhooks build a ClientScope from job data instead. */
export async function getClientScope(
  permission: ClientPermission = 'view',
  selectedClientId?: string | null
): Promise<ClientScope> {
  const resolved =
    selectedClientId !== undefined ? selectedClientId : await resolveSelectedClientId();
  return scopeFromAccess(await getAccess(), resolved, permission);
}

/** For API-key requests: whole organization, or a single client when the key is scoped. */
export function organizationScope(organizationId: string, customerId?: string | null): ClientScope {
  if (customerId) {
    return { organizationId, customerIds: [customerId] };
  }
  return { organizationId, customerIds: 'all' };
}

/**
 * The one place that turns a scope into a Prisma `where` fragment.
 * Rows with `customerId = null` (agency-owned data) are visible only when the scope is 'all'.
 */
export function scopeWhere(scope: ClientScope): { organizationId: string; customerId?: { in: string[] } } {
  if (scope.customerIds === 'all') return { organizationId: scope.organizationId };
  return { organizationId: scope.organizationId, customerId: { in: scope.customerIds } };
}
