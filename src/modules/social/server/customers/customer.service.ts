import 'server-only';
import type { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/shared/lib/prisma';
import { HttpError } from '@/shared/server/http-error';
import type { ClientScope } from '@/shared/server/client-scope';
import { planService } from '../billing/plan.service';
import { integrationRegistry } from '../integrations/core/integration.registry';
import { groupAssets, type GroupableAsset } from './client-grouping';
import {
  clientLinksFromCreate,
  type BulkAssignBody,
  type ClientAssetLinks,
  type CreateClientBody,
  type UpdateClientLinksBody,
} from './customer.schema';

const clientListInclude = {
  approvers: { select: { id: true, name: true, email: true } },
  adAccounts: { select: { id: true, name: true, externalId: true }, orderBy: { name: 'asc' as const } },
  googleAdsAccounts: {
    select: { id: true, name: true, googleCustomerId: true },
    orderBy: { name: 'asc' as const },
  },
  integrations: {
    where: { deletedAt: null },
    select: { id: true, name: true, providerIdentifier: true, username: true },
    orderBy: { name: 'asc' as const },
  },
} satisfies Prisma.SocialCustomerInclude;

function assertAllFound(found: string[], requested: string[], label: string) {
  const have = new Set(found);
  if (requested.every((id) => have.has(id))) return;
  throw new HttpError(400, `One or more ${label} were not found in this workspace`);
}

async function assignIntegrations(
  tx: Prisma.TransactionClient,
  organizationId: string,
  customerId: string,
  ids: string[],
  replace: boolean
) {
  if (ids.length > 0) {
    const rows = await tx.socialIntegration.findMany({
      where: { organizationId, id: { in: ids }, deletedAt: null },
      select: { id: true },
    });
    assertAllFound(
      rows.map((row) => row.id),
      ids,
      'social channels'
    );
  }

  if (replace) {
    await tx.socialIntegration.updateMany({
      where: {
        organizationId,
        customerId,
        ...(ids.length > 0 ? { id: { notIn: ids } } : {}),
      },
      data: { customerId: null },
    });
  }

  if (ids.length === 0) return;
  await tx.socialIntegration.updateMany({
    where: { organizationId, id: { in: ids }, deletedAt: null },
    data: { customerId },
  });
}

async function assignMetaAdAccounts(
  tx: Prisma.TransactionClient,
  organizationId: string,
  customerId: string,
  ids: string[],
  replace: boolean
) {
  if (ids.length > 0) {
    const rows = await tx.adAccount.findMany({
      where: { organizationId, externalId: { in: ids } },
      select: { externalId: true },
    });
    assertAllFound(
      rows.map((row) => row.externalId),
      ids,
      'Meta ad accounts'
    );
  }

  if (replace) {
    await tx.adAccount.updateMany({
      where: {
        organizationId,
        customerId,
        ...(ids.length > 0 ? { externalId: { notIn: ids } } : {}),
      },
      data: { customerId: null },
    });
  }

  if (ids.length === 0) return;
  await tx.adAccount.updateMany({
    where: { organizationId, externalId: { in: ids } },
    data: { customerId },
  });
}

async function assignGoogleAdAccounts(
  tx: Prisma.TransactionClient,
  organizationId: string,
  customerId: string,
  ids: string[],
  replace: boolean
) {
  if (ids.length > 0) {
    const rows = await tx.socialGoogleAdsAccount.findMany({
      where: { organizationId, googleCustomerId: { in: ids } },
      select: { googleCustomerId: true },
    });
    assertAllFound(
      rows.map((row) => row.googleCustomerId),
      ids,
      'Google Ads accounts'
    );
  }

  if (replace) {
    await tx.socialGoogleAdsAccount.updateMany({
      where: {
        organizationId,
        customerId,
        ...(ids.length > 0 ? { googleCustomerId: { notIn: ids } } : {}),
      },
      data: { customerId: null },
    });
  }

  if (ids.length === 0) return;
  await tx.socialGoogleAdsAccount.updateMany({
    where: { organizationId, googleCustomerId: { in: ids } },
    data: { customerId },
  });
}

async function assignLinks(
  tx: Prisma.TransactionClient,
  organizationId: string,
  customerId: string,
  links: Partial<ClientAssetLinks>,
  replace: boolean
) {
  if (links.integrationIds) {
    await assignIntegrations(tx, organizationId, customerId, links.integrationIds, replace);
  }
  if (links.adAccountIds) {
    await assignMetaAdAccounts(tx, organizationId, customerId, links.adAccountIds, replace);
  }
  if (links.googleAdAccountIds) {
    await assignGoogleAdAccounts(tx, organizationId, customerId, links.googleAdAccountIds, replace);
  }
}

export const customerService = {
  async listCustomers(scope: ClientScope) {
    return prisma.socialCustomer.findMany({
      where: {
        organizationId: scope.organizationId,
        deletedAt: null,
        ...(scope.customerIds === 'all' ? {} : { id: { in: scope.customerIds } }),
      },
      include: clientListInclude,
      orderBy: { createdAt: 'desc' },
    });
  },

  async createClient(organizationId: string, body: CreateClientBody) {
    await planService.assertClientCapacity(organizationId);
    const links = clientLinksFromCreate(body);

    return prisma.$transaction(async (tx) => {
      const customer = await tx.socialCustomer.create({
        data: {
          organizationId,
          name: body.name,
          onboardingStep: 'created',
        },
      });

      await tx.clientApprover.create({
        data: {
          organizationId,
          customerId: customer.id,
          email: body.approverEmail,
          name: body.approverName,
        },
      });

      await assignLinks(tx, organizationId, customer.id, links, false);
      return customer;
    });
  },

  async updateClientLinks(organizationId: string, customerId: string, body: UpdateClientLinksBody) {
    const customer = await prisma.socialCustomer.findFirst({
      where: { id: customerId, organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!customer) throw new HttpError(404, 'Client not found');

    const links: Partial<ClientAssetLinks> = {};
    if (body.integrationIds) links.integrationIds = [...new Set(body.integrationIds)];
    if (body.adAccountIds) links.adAccountIds = [...new Set(body.adAccountIds)];
    if (body.googleAdAccountIds) links.googleAdAccountIds = [...new Set(body.googleAdAccountIds)];

    await prisma.$transaction(async (tx) => {
      await assignLinks(tx, organizationId, customerId, links, true);
    });

    return prisma.socialCustomer.findFirstOrThrow({
      where: { id: customerId, organizationId },
      include: clientListInclude,
    });
  },

  /**
   * Sort-channels screen: every channel / ad account not yet on a client, grouped by brand name and
   * matched to an existing client where the names agree.
   */
  async suggestAssignments(organizationId: string) {
    const [channels, adAccounts, googleAdAccounts, clients] = await Promise.all([
      prisma.socialIntegration.findMany({
        where: { organizationId, deletedAt: null, customerId: null },
        select: { id: true, name: true, username: true, providerIdentifier: true },
      }),
      prisma.adAccount.findMany({
        where: { organizationId, customerId: null },
        select: { externalId: true, name: true },
      }),
      prisma.socialGoogleAdsAccount.findMany({
        where: { organizationId, customerId: null },
        select: { googleCustomerId: true, name: true },
      }),
      prisma.socialCustomer.findMany({
        where: { organizationId, deletedAt: null },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    const assets: GroupableAsset[] = [
      ...channels.map((row) => ({
        kind: 'channel' as const,
        id: row.id,
        name: row.name,
        username: row.username,
        provider: integrationRegistry.get(row.providerIdentifier)?.name ?? row.providerIdentifier,
      })),
      ...adAccounts.map((row) => ({ kind: 'meta_ad' as const, id: row.externalId, name: row.name, provider: 'Meta Ads' })),
      ...googleAdAccounts.map((row) => ({
        kind: 'google_ad' as const,
        id: row.googleCustomerId,
        name: row.name,
        provider: 'Google Ads',
      })),
    ];

    const plan = await planService.get(organizationId);
    return {
      clients,
      groups: groupAssets(assets, clients),
      clientLimit: plan.maxClients,
      planLabel: plan.label,
    };
  },

  /** Apply the sort-channels screen: create the new clients and move each group's assets onto them. */
  async bulkAssign(organizationId: string, body: BulkAssignBody) {
    const plan = await planService.get(organizationId);
    const newNames = body.groups.filter((g) => g.newClientName).length;
    if (newNames > 0) {
      const used = await prisma.socialCustomer.count({ where: { organizationId, deletedAt: null } });
      if (used + newNames > plan.maxClients) {
        throw new HttpError(
          402,
          `This creates ${newNames} new clients but the ${plan.label} plan allows ${plan.maxClients} (${used} used). Assign some groups to existing clients, or move to a bigger plan.`
        );
      }
    }

    const existingIds = [...new Set(body.groups.map((g) => g.clientId).filter((id): id is string => Boolean(id)))];
    if (existingIds.length > 0) {
      const found = await prisma.socialCustomer.findMany({
        where: { organizationId, deletedAt: null, id: { in: existingIds } },
        select: { id: true },
      });
      assertAllFound(
        found.map((row) => row.id),
        existingIds,
        'clients'
      );
    }

    return prisma.$transaction(async (tx) => {
      let created = 0;
      let moved = 0;
      // Same new name twice (two groups the matcher kept apart) → one client.
      const createdByName = new Map<string, string>();
      for (const group of body.groups) {
        let customerId = group.clientId ?? null;
        if (!customerId && group.newClientName) {
          const nameKey = group.newClientName.toLowerCase();
          customerId = createdByName.get(nameKey) ?? null;
          if (!customerId) {
            const customer = await tx.socialCustomer.create({
              data: { organizationId, name: group.newClientName, onboardingStep: 'created' },
            });
            customerId = customer.id;
            createdByName.set(nameKey, customerId);
            created += 1;
          }
        }
        if (!customerId) continue;
        await assignLinks(
          tx,
          organizationId,
          customerId,
          {
            integrationIds: [...new Set(group.integrationIds)],
            adAccountIds: [...new Set(group.adAccountIds)],
            googleAdAccountIds: [...new Set(group.googleAdAccountIds)],
          },
          false
        );
        moved += group.integrationIds.length + group.adAccountIds.length + group.googleAdAccountIds.length;
      }
      return { created, moved };
    });
  },

  /** Org-wide channels and ad accounts for the add/edit client pickers (ignores the client switcher). */
  async listAssignable(organizationId: string) {
    const [channels, adAccounts, googleAdAccounts] = await Promise.all([
      prisma.socialIntegration.findMany({
        where: { organizationId, deletedAt: null },
        select: {
          id: true,
          name: true,
          providerIdentifier: true,
          customerId: true,
          customer: { select: { id: true, name: true } },
        },
        orderBy: { name: 'asc' },
      }),
      prisma.adAccount.findMany({
        where: { organizationId },
        select: {
          externalId: true,
          name: true,
          customerId: true,
          customer: { select: { name: true } },
        },
        orderBy: { name: 'asc' },
      }),
      prisma.socialGoogleAdsAccount.findMany({
        where: { organizationId },
        select: {
          googleCustomerId: true,
          name: true,
          customerId: true,
          customer: { select: { name: true } },
        },
        orderBy: { name: 'asc' },
      }),
    ]);

    return {
      channels: channels.map((row) => ({
        id: row.id,
        name: row.name,
        providerName: integrationRegistry.get(row.providerIdentifier)?.name ?? row.providerIdentifier,
        customerId: row.customerId,
        customerName: row.customer?.name ?? null,
      })),
      adAccounts: adAccounts.map((row) => ({
        id: row.externalId,
        name: row.name,
        customerId: row.customerId,
        customerName: row.customer?.name ?? null,
      })),
      googleAdAccounts: googleAdAccounts.map((row) => ({
        id: row.googleCustomerId,
        name: row.name,
        customerId: row.customerId,
        customerName: row.customer?.name ?? null,
      })),
    };
  },
};
