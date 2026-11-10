import 'server-only';
import { getAccess, type ClientPermission } from '@/shared/server/access';
import { resolveSelectedClientId, scopeFromAccess } from '@/shared/server/client-scope';
import { growthClientFromScope, type GrowthClient } from './growth-scope';

export interface GrowthRequest {
  gc: GrowthClient;
  userId: string;
  userName: string;
  /** May approve / send back tasks, decide ads and blogs, connect the store, change goals. */
  canReview: boolean;
  /** Organization owner / admin (connects org-wide logins such as Google Analytics). */
  isAdmin: boolean;
}

/**
 * Route-handler entry for every Growth Desk endpoint: logged-in user, one selected client,
 * and the client permission this action needs (view < draft < approve).
 */
export async function growthRequest(permission: ClientPermission = 'view'): Promise<GrowthRequest> {
  const access = await getAccess();
  const scope = scopeFromAccess(access, await resolveSelectedClientId(), permission);
  const gc = await growthClientFromScope(scope);
  return {
    gc,
    userId: access.user.id,
    userName: access.user.name || access.user.email,
    canReview: access.can('approve', gc.customerId),
    isAdmin: access.role === 'OWNER' || access.role === 'ADMIN',
  };
}
