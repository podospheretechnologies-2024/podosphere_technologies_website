import 'server-only';
import { cookies } from 'next/headers';
import { getCurrentOrganization } from './current-organization';
import { approvalService } from '@/modules/social/server/approvals/approval.service';
import { HttpError } from './http-error';

export async function getCurrentOrganizationOrClient() {
  try {
    // Try regular agency user first
    const organization = await getCurrentOrganization();
    return { organization, customerId: undefined };
  } catch (error) {
    // If not logged in as agency, try client approver session
    const cookieStore = await cookies();
    const token = cookieStore.get('approver_session')?.value;
    
    if (token) {
      try {
        const verified = await approvalService.verifyToken(token);
        return { 
          organization: { id: verified.organizationId }, 
          customerId: verified.customerId 
        };
      } catch (e) {
        throw new HttpError(401, 'Please log in');
      }
    }
    
    throw new HttpError(401, 'Please log in');
  }
}
