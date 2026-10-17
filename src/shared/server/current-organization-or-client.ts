import 'server-only';
import { getCurrentOrganization } from './current-organization';
import { getPortalSessionOrNull } from './portal-session';
import { HttpError } from './http-error';

export async function getCurrentOrganizationOrClient() {
  try {
    // Try regular agency user first.
    const organization = await getCurrentOrganization();
    return { organization, customerId: undefined };
  } catch {
    // Not logged in as agency — try a client approver portal session instead.
    const session = await getPortalSessionOrNull();
    if (!session) {
      throw new HttpError(401, 'Please log in');
    }
    return {
      organization: { id: session.organizationId },
      customerId: session.customerId,
    };
  }
}
