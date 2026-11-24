import 'server-only';
import type { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/shared/lib/prisma';
import { HttpError } from '@/shared/server/http-error';
import { socialCustomerIdWhere, type ClientScope } from '@/shared/server/client-scope';
import { parsePortalTabsConfig } from '../../config/portal-tabs';
import { planService } from '../billing/plan.service';
import { integrationRegistry } from '../integrations/core/integration.registry';
import { logAudit } from '@/shared/server/audit.service';
import { advanceOnboardingStep } from './onboarding-progress';
import { CHANNEL_MAPPING_SELECT, moveChannelRows } from './channel-mapping';
import { groupAssets, type GroupableAsset } from './client-grouping';
import {
  clientLinksFromCreate,
  type BulkAssignBody,
  type ClientAssetLinks,
  type CreateClientBody,
  type UpdateClientLinksBody,
} from './customer.schema';

/** Copy Organization.portalTabDefaults onto a new SocialCustomer when set. */
async function portalTabsFromOrgDefaults(
  tx: Prisma.TransactionClient,
  organizationId: string
): Promise<Prisma.InputJsonValue | undefined> {
  const org = await tx.organization.findFirst({
    where: { id: organizationId },
    select: { portalTabDefaults: true },
  });
  const config = parsePortalTabsConfig(org?.portalTabDefaults);
  return config ? (config as Prisma.InputJsonValue) : undefined;
}

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

/** Moves needing a confirm (R6 / PS-04): the asset is already on another client. */
async function refuseSilentMoves(
  tx: Prisma.TransactionClient,
  organizationId: string,
  owners: { name: string; customerId: string | null }[],
  customerId: string,
  force: boolean,
  label: string
) {
  if (force) return;
  const elsewhere = owners.filter((row) => row.customerId && row.customerId !== customerId);
  if (elsewhere.length === 0) return;
  const clients = await tx.socialCustomer.findMany({
    where: { organizationId, id: { in: elsewhere.map((row) => row.customerId as string) } },
    select: { id: true, name: true },
  });
  const nameById = new Map(clients.map((row) => [row.id, row.name]));
  const list = elsewhere
    .map((row) => `${row.name} (on ${nameById.get(row.customerId as string) ?? 'another client'})`)
    .join(', ');
  throw new HttpError(
    409,
    `These ${label} already belong to another client: ${list}. Confirm the move to continue.`
  );
}

async function assignIntegrations(
  tx: Prisma.TransactionClient,
  organizationId: string,
  customerId: string,
  ids: string[],
  replace: boolean,
  force = false
) {
  const requested =
    ids.length > 0
      ? await tx.socialIntegration.findMany({
          where: { organizationId, id: { in: ids }, deletedAt: null },
          select: CHANNEL_MAPPING_SELECT,
        })
      : [];
  if (ids.length > 0) {
    assertAllFound(
      requested.map((row) => row.id),
      ids,
      'social channels'
    );
    await refuseSilentMoves(tx, organizationId, requested, customerId, force, 'channels');
  }

  const moves: { channel: (typeof requested)[number]; from: string | null; to: string | null }[] = [];
  if (replace) {
    const dropped = await tx.socialIntegration.findMany({
      where: {
        organizationId,
        customerId,
        ...(ids.length > 0 ? { id: { notIn: ids } } : {}),
      },
      select: CHANNEL_MAPPING_SELECT,
    });
    for (const channel of dropped) moves.push({ channel, from: customerId, to: null });
  }
  for (const channel of requested) {
    if (channel.customerId !== customerId) moves.push({ channel, from: channel.customerId, to: customerId });
  }

  // R6: the channel and the rows that came from it move together, in this transaction.
  for (const move of moves) {
    await tx.socialIntegration.update({
      where: { id: move.channel.id },
      data: { customerId: move.to },
    });
    const counts = await moveChannelRows(tx, organizationId, move.channel, move.from, move.to);
    await logAudit({
      action: move.to === null ? 'integration.unmap' : move.from === null ? 'integration.map' : 'integration.move',
      targetType: 'integration',
      targetId: move.channel.id,
      metadata: { name: move.channel.name, from: move.from, to: move.to, ...counts },
    });
  }
}

async function assignMetaAdAccounts(
  tx: Prisma.TransactionClient,
  organizationId: string,
  customerId: string,
  ids: string[],
  replace: boolean,
  force = false
) {
  if (ids.length > 0) {
    const rows = await tx.adAccount.findMany({
      where: { organizationId, externalId: { in: ids } },
      select: { externalId: true, name: true, customerId: true, isAgencyAccount: true },
    });
    assertAllFound(
      rows.map((row) => row.externalId),
      ids,
      'Meta ad accounts'
    );
    // PS-04: an ad account on another client (or the agency's own account) never moves silently.
    await refuseSilentMoves(tx, organizationId, rows, customerId, force, 'ad accounts');
    const agency = rows.filter((row) => row.isAgencyAccount);
    if (agency.length > 0 && !force) {
      throw new HttpError(
        409,
        `${agency.map((row) => row.name).join(', ')} is marked as the agency's own ad account. Confirm to assign it to a client.`
      );
    }
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
  replace: boolean,
  force = false
) {
  if (links.integrationIds) {
    await assignIntegrations(tx, organizationId, customerId, links.integrationIds, replace, force);
  }
  if (links.adAccountIds) {
    await assignMetaAdAccounts(tx, organizationId, customerId, links.adAccountIds, replace, force);
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
        ...socialCustomerIdWhere(scope),
      },
      include: clientListInclude,
      orderBy: { createdAt: 'desc' },
    });
  },

  async createClient(organizationId: string, body: CreateClientBody) {
    await planService.assertClientCapacity(organizationId);
    const links = clientLinksFromCreate(body);

    return prisma.$transaction(async (tx) => {
      const portalTabs = await portalTabsFromOrgDefaults(tx, organizationId);
      const customer = await tx.socialCustomer.create({
        data: {
          organizationId,
          name: body.name,
          onboardingStep: 'created',
          clientType: body.clientType ?? null,
          ...(portalTabs !== undefined ? { portalTabs } : {}),
        },
      });

      const emailTaken = await tx.clientApprover.findFirst({
        where: { organizationId, email: body.approverEmail.toLowerCase() },
        select: { id: true },
      });
      if (emailTaken) {
        throw new HttpError(409, 'That approver email already has portal access in this workspace');
      }

      await tx.clientApprover.create({
        data: {
          organizationId,
          customerId: customer.id,
          email: body.approverEmail.toLowerCase(),
          name: body.approverName,
        },
      });

      await assignLinks(tx, organizationId, customer.id, links, false, body.force === true);
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
      await assignLinks(tx, organizationId, customerId, links, true, body.force === true);
      if (body.clientType !== undefined) {
        await tx.socialCustomer.update({ where: { id: customerId }, data: { clientType: body.clientType } });
      }
    });
    if ((links.integrationIds?.length ?? 0) > 0) {
      await advanceOnboardingStep(organizationId, customerId, 'brand_kit');
    }

    return prisma.socialCustomer.findFirstOrThrow({
      where: { id: customerId, organizationId },
      include: clientListInclude,
    });
  },

  /**
   * Admin soft-delete: hide the client from the agency list, unlink channels/ads so they can be
   * reassigned, and kill portal/magic-link access. Does NOT disconnect Meta/Google tokens or
   * wipe posts/media — those stay on the org as unlinked history.
   */
  async softDeleteClient(organizationId: string, customerId: string) {
    const customer = await prisma.socialCustomer.findFirst({
      where: { id: customerId, organizationId, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!customer) throw new HttpError(404, 'Client not found');

    const now = new Date();
    await prisma.$transaction(async (tx) => {
      // R6 unmap: the channels go back to Unassigned, and so do the rows that came from them.
      const channels = await tx.socialIntegration.findMany({
        where: { organizationId, customerId },
        select: CHANNEL_MAPPING_SELECT,
      });
      for (const channel of channels) {
        await moveChannelRows(tx, organizationId, channel, customerId, null);
      }
      await tx.socialIntegration.updateMany({
        where: { organizationId, customerId },
        data: { customerId: null },
      });
      await tx.adAccount.updateMany({
        where: { organizationId, customerId },
        data: { customerId: null },
      });
      await tx.socialGoogleAdsAccount.updateMany({
        where: { organizationId, customerId },
        data: { customerId: null },
      });
      await tx.clientApprover.updateMany({
        where: { organizationId, customerId, disabledAt: null },
        data: { disabledAt: now, tokenVersion: { increment: 1 } },
      });
      await tx.socialCustomer.update({
        where: { id: customerId },
        data: { deletedAt: now },
      });
    });

    return { id: customer.id, name: customer.name, deletedAt: now.toISOString() };
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
            const portalTabs = await portalTabsFromOrgDefaults(tx, organizationId);
            const customer = await tx.socialCustomer.create({
              data: {
                organizationId,
                name: group.newClientName,
                onboardingStep: 'created',
                ...(portalTabs !== undefined ? { portalTabs } : {}),
              },
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
