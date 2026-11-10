import 'server-only';
import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/shared/lib/prisma';
import { HttpError } from '@/shared/server/http-error';
import {
  parsePortalGoals,
  type PortalGoalsConfig,
} from './portal-goals.schema';

export type PortalGoalsDto = {
  goals: PortalGoalsConfig;
};

export const portalGoalsService = {
  async get(organizationId: string, customerId: string): Promise<PortalGoalsDto> {
    const customer = await prisma.socialCustomer.findFirst({
      where: { id: customerId, organizationId, deletedAt: null },
      select: { portalGoals: true },
    });
    if (!customer) throw new HttpError(404, 'Client not found');
    return { goals: parsePortalGoals(customer.portalGoals) };
  },

  async update(
    organizationId: string,
    customerId: string,
    body: PortalGoalsConfig
  ): Promise<PortalGoalsDto> {
    const customer = await prisma.socialCustomer.findFirst({
      where: { id: customerId, organizationId, deletedAt: null },
      select: { id: true, portalGoals: true },
    });
    if (!customer) throw new HttpError(404, 'Client not found');

    const current = parsePortalGoals(customer.portalGoals);
    const next: PortalGoalsConfig = { ...current };

    if (body.leadsPerMonth !== undefined) {
      next.leadsPerMonth = body.leadsPerMonth;
    }
    if (body.postsPerMonth !== undefined) {
      next.postsPerMonth = body.postsPerMonth;
    }
    if (body.adBudgetPerMonth !== undefined) {
      next.adBudgetPerMonth = body.adBudgetPerMonth;
    }

    // Drop nulls so empty goals clear the column when nothing left
    const cleaned: PortalGoalsConfig = {};
    if (typeof next.leadsPerMonth === 'number') cleaned.leadsPerMonth = next.leadsPerMonth;
    if (typeof next.postsPerMonth === 'number') cleaned.postsPerMonth = next.postsPerMonth;
    if (typeof next.adBudgetPerMonth === 'number') cleaned.adBudgetPerMonth = next.adBudgetPerMonth;

    await prisma.socialCustomer.update({
      where: { id: customerId },
      data: {
        portalGoals:
          Object.keys(cleaned).length > 0
            ? (cleaned as Prisma.InputJsonValue)
            : Prisma.DbNull,
      },
    });

    return { goals: cleaned };
  },
};
