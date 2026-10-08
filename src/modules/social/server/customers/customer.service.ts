import 'server-only';
import { prisma } from '@/shared/lib/prisma';
import { getAccess } from '@/shared/server/access';

export const customerService = {
  async listCustomers() {
    const ctx = await getAccess();
    return prisma.socialCustomer.findMany({
      where: { organizationId: ctx.organization.id },
      orderBy: { createdAt: 'desc' }
    });
  },

  async createCustomer(name: string, email: string) {
    const ctx = await getAccess();
    
    // Enforce plan limits
    const count = await prisma.socialCustomer.count({
      where: { organizationId: ctx.organization.id }
    });
    
    if (count >= ctx.organization.maxClients) {
      throw new Error(`Plan limit reached. Max clients: ${ctx.organization.maxClients}`);
    }

    return prisma.socialCustomer.create({
      data: {
        organizationId: ctx.organization.id,
        name,
        email,
      }
    });
  }
};
