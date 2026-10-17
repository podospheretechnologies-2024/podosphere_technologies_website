import 'server-only';
import { prisma } from '@/shared/lib/prisma';
import { getAccess } from '@/shared/server/access';
import { planService } from '../billing/plan.service';

export const customerService = {
  async listCustomers() {
    const ctx = await getAccess();
    return prisma.socialCustomer.findMany({
      where: { organizationId: ctx.organization.id, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  },

  async createCustomer(name: string, _email: string) {
    const ctx = await getAccess();
    await planService.assertClientCapacity(ctx.organization.id);

    return prisma.socialCustomer.create({
      data: {
        organizationId: ctx.organization.id,
        name,
        onboardingStep: 'created',
      },
    });
  },
};
