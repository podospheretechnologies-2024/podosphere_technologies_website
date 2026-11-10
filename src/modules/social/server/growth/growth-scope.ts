import 'server-only';
import { prisma } from '@/shared/lib/prisma';
import type { ClientPermission } from '@/shared/server/access';
import { getClientScope, type ClientScope } from '@/shared/server/client-scope';
import { HttpError } from '@/shared/server/http-error';

export interface GrowthClient {
  scope: ClientScope;
  organizationId: string;
  customerId: string;
  customerName: string;
}

/**
 * The Growth Desk always works on ONE client. Returns that client, or 400 when the switcher is on
 * "All clients" (the page then shows the all-clients summary instead).
 */
export async function requireGrowthClient(permission: ClientPermission = 'view'): Promise<GrowthClient> {
  const scope = await getClientScope(permission);
  return growthClientFromScope(scope);
}

export async function growthClientFromScope(scope: ClientScope): Promise<GrowthClient> {
  if (scope.customerIds === 'all' || scope.customerIds.length !== 1) {
    throw new HttpError(400, 'Pick a client in the client switcher first.');
  }
  const customerId = scope.customerIds[0];
  const customer = await prisma.socialCustomer.findFirst({
    where: { id: customerId, organizationId: scope.organizationId, deletedAt: null },
    select: { id: true, name: true },
  });
  if (!customer) throw new HttpError(404, 'Not found');
  return { scope, organizationId: scope.organizationId, customerId, customerName: customer.name };
}

/** Worker-side: a one-client scope built from stored ids (no request). */
export function workerScope(organizationId: string, customerId: string): ClientScope {
  return { organizationId, customerIds: [customerId] };
}
