import 'server-only';
import { prisma } from '@/shared/lib/prisma';
import { HttpError } from '@/shared/server/http-error';
import { planOrDefault, type PlanFeature, type PlanKey, PLANS } from '../../config/plans';

export const planService = {
  async get(organizationId: string) {
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { plan: true, maxClients: true, maxUsers: true, maxChannels: true },
    });
    if (!organization) {
      throw new HttpError(404, 'Organization not found');
    }
    const definition = planOrDefault(organization.plan);
    return { ...definition, ...organization, catalog: Object.values(PLANS) };
  },

  async assertFeature(organizationId: string, feature: PlanFeature): Promise<void> {
    const current = await this.get(organizationId);
    if (!planOrDefault(current.plan).features.includes(feature)) {
      throw new HttpError(402, `${feature} is not included in the ${current.label} plan`);
    }
  },

  async assertChannelCapacity(organizationId: string): Promise<void> {
    const current = await this.get(organizationId);
    const used = await prisma.socialIntegration.count({
      where: { organizationId, deletedAt: null },
    });
    if (used >= current.maxChannels) {
      throw new HttpError(402, `Channel limit reached (${current.maxChannels} on ${current.label})`);
    }
  },

  async apply(organizationId: string, plan: PlanKey): Promise<void> {
    const definition = PLANS[plan];
    await prisma.organization.update({
      where: { id: organizationId },
      data: {
        plan,
        maxClients: definition.maxClients,
        maxUsers: definition.maxUsers,
        maxChannels: definition.maxChannels,
        status: 'ACTIVE',
      },
    });
  },
};
