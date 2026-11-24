import 'server-only';
import { prisma } from '@/shared/lib/prisma';
import { HttpError } from '@/shared/server/http-error';
import { Prisma } from '@/generated/prisma/client';
import {
  daysFromToday,
  monthKeyFromDate,
  OPS_CLIENT_STATUSES,
  OPS_SERVICE_CATEGORIES,
  type OpsClientStatus,
  type OpsServiceCategory,
} from './ops.constants';
import type {
  CreateOpsClientBody,
  CreateOpsPaymentBody,
  UpdateOpsClientBody,
  UpdateOpsPaymentBody,
} from './ops.schema';

function dec(value: Prisma.Decimal | number | null | undefined): number | null {
  if (value == null) return null;
  return typeof value === 'number' ? value : Number(value);
}

function money(value: Prisma.Decimal | number | null | undefined): number {
  return dec(value) ?? 0;
}

function dateOnly(value: string | null | undefined): Date | null {
  if (!value) return null;
  return new Date(`${value}T00:00:00.000Z`);
}

function serializeService(row: {
  id: string;
  category: string;
  subtype: string;
  groupLabel: string | null;
}) {
  return {
    id: row.id,
    category: row.category as OpsServiceCategory,
    subtype: row.subtype,
    groupLabel: row.groupLabel,
  };
}

function serializeClient(row: {
  id: string;
  organizationId: string;
  socialCustomerId: string | null;
  name: string;
  status: string;
  engagementType: string | null;
  monthlyFee: Prisma.Decimal | null;
  retainerStart: Date | null;
  retainerMonths: number | null;
  teamNames: string | null;
  notes: string | null;
  workStatus: string | null;
  escalation: string | null;
  category: string | null;
  createdAt: Date;
  updatedAt: Date;
  services?: Array<{
    id: string;
    category: string;
    subtype: string;
    groupLabel: string | null;
  }>;
}) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    socialCustomerId: row.socialCustomerId,
    name: row.name,
    status: row.status as OpsClientStatus,
    engagementType: row.engagementType,
    monthlyFee: dec(row.monthlyFee),
    retainerStart: row.retainerStart?.toISOString().slice(0, 10) ?? null,
    retainerMonths: row.retainerMonths,
    teamNames: row.teamNames,
    notes: row.notes,
    workStatus: row.workStatus,
    escalation: row.escalation,
    category: row.category,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    services: (row.services ?? []).map(serializeService),
  };
}

function serializePayment(row: {
  id: string;
  organizationId: string;
  clientId: string;
  amount: Prisma.Decimal | null;
  description: string | null;
  dueDate: Date | null;
  paidAt: Date | null;
  monthKey: string;
  createdAt: Date;
  updatedAt: Date;
  client?: { id: string; name: string };
}) {
  const dueInDays = row.paidAt ? null : daysFromToday(row.dueDate);
  return {
    id: row.id,
    organizationId: row.organizationId,
    clientId: row.clientId,
    clientName: row.client?.name ?? null,
    amount: dec(row.amount),
    description: row.description,
    dueDate: row.dueDate?.toISOString().slice(0, 10) ?? null,
    paidAt: row.paidAt?.toISOString() ?? null,
    monthKey: row.monthKey,
    dueInDays,
    bucket: paymentBucket(row.paidAt, dueInDays),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function paymentBucket(
  paidAt: Date | null,
  dueInDays: number | null
): 'overdue' | 'next_7' | 'later' | 'no_due_date' | 'paid' {
  if (paidAt) return 'paid';
  if (dueInDays == null) return 'no_due_date';
  if (dueInDays < 0) return 'overdue';
  if (dueInDays <= 7) return 'next_7';
  return 'later';
}

async function requireOpsClient(organizationId: string, clientId: string) {
  const client = await prisma.opsClient.findFirst({
    where: { id: clientId, organizationId, deletedAt: null },
  });
  if (!client) throw new HttpError(404, 'Client not found');
  return client;
}

/** The Social client must belong to the same organization (the FK alone does not check that). */
async function assertSocialCustomerInOrg(organizationId: string, socialCustomerId: string | null | undefined) {
  if (!socialCustomerId) return;
  const found = await prisma.socialCustomer.findFirst({
    where: { id: socialCustomerId, organizationId, deletedAt: null },
    select: { id: true },
  });
  if (!found) throw new HttpError(400, 'Linked Social client not found in this workspace');
}

/**
 * PS-12: Client Desk lists the same clients as Social. Each Social client without a desk row gets one:
 * an unlinked desk row with the same name is linked, otherwise a new row is created.
 */
async function ensureOpsClientsForSocialCustomers(organizationId: string) {
  const [socialClients, deskRows] = await Promise.all([
    prisma.socialCustomer.findMany({
      where: { organizationId, deletedAt: null },
      select: { id: true, name: true },
    }),
    prisma.opsClient.findMany({
      where: { organizationId, deletedAt: null },
      select: { id: true, name: true, socialCustomerId: true },
    }),
  ]);
  const linked = new Set(deskRows.map((row) => row.socialCustomerId).filter(Boolean));
  const unlinkedByName = new Map(
    deskRows.filter((row) => !row.socialCustomerId).map((row) => [row.name.trim().toLowerCase(), row.id])
  );
  for (const client of socialClients) {
    if (linked.has(client.id)) continue;
    const sameName = unlinkedByName.get(client.name.trim().toLowerCase());
    if (sameName) {
      await prisma.opsClient.update({ where: { id: sameName }, data: { socialCustomerId: client.id } });
      unlinkedByName.delete(client.name.trim().toLowerCase());
    } else {
      await prisma.opsClient.create({
        data: { organizationId, name: client.name, socialCustomerId: client.id },
      });
    }
  }
}

export const opsService = {
  async listClients(organizationId: string) {
    await ensureOpsClientsForSocialCustomers(organizationId);
    const rows = await prisma.opsClient.findMany({
      where: { organizationId, deletedAt: null },
      include: { services: { orderBy: [{ category: 'asc' }, { subtype: 'asc' }] } },
      orderBy: [{ name: 'asc' }],
    });
    return rows.map(serializeClient);
  },

  async getClient(organizationId: string, clientId: string) {
    const row = await prisma.opsClient.findFirst({
      where: { id: clientId, organizationId, deletedAt: null },
      include: { services: { orderBy: [{ category: 'asc' }, { subtype: 'asc' }] } },
    });
    if (!row) throw new HttpError(404, 'Client not found');
    return serializeClient(row);
  },

  async createClient(organizationId: string, body: CreateOpsClientBody) {
    await assertSocialCustomerInOrg(organizationId, body.socialCustomerId);
    const services = body.services ?? [];
    const row = await prisma.opsClient.create({
      data: {
        organizationId,
        name: body.name,
        status: body.status ?? 'not_started',
        engagementType: body.engagementType ?? null,
        monthlyFee: body.monthlyFee ?? null,
        retainerStart: dateOnly(body.retainerStart ?? null),
        retainerMonths: body.retainerMonths ?? null,
        teamNames: body.teamNames ?? null,
        notes: body.notes ?? null,
        workStatus: body.workStatus ?? 'Not started',
        escalation: body.escalation ?? 'None',
        category: body.category ?? null,
        socialCustomerId: body.socialCustomerId ?? null,
        services: {
          create: services.map((s) => ({
            organizationId,
            category: s.category,
            subtype: s.subtype,
            groupLabel: s.groupLabel ?? null,
          })),
        },
      },
      include: { services: true },
    });
    return serializeClient(row);
  },

  async updateClient(organizationId: string, clientId: string, body: UpdateOpsClientBody) {
    await requireOpsClient(organizationId, clientId);
    await assertSocialCustomerInOrg(organizationId, body.socialCustomerId);

    const data: Prisma.OpsClientUncheckedUpdateInput = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.status !== undefined) data.status = body.status;
    if (body.engagementType !== undefined) data.engagementType = body.engagementType;
    if (body.monthlyFee !== undefined) data.monthlyFee = body.monthlyFee;
    if (body.retainerStart !== undefined) data.retainerStart = dateOnly(body.retainerStart);
    if (body.retainerMonths !== undefined) data.retainerMonths = body.retainerMonths;
    if (body.teamNames !== undefined) data.teamNames = body.teamNames;
    if (body.notes !== undefined) data.notes = body.notes;
    if (body.workStatus !== undefined) data.workStatus = body.workStatus;
    if (body.escalation !== undefined) data.escalation = body.escalation;
    if (body.category !== undefined) data.category = body.category;
    if (body.socialCustomerId !== undefined) data.socialCustomerId = body.socialCustomerId;

    if (body.services) {
      await prisma.$transaction([
        prisma.opsClientService.deleteMany({ where: { clientId, organizationId } }),
        prisma.opsClient.update({
          where: { id: clientId },
          data: {
            ...data,
            services: {
              create: body.services.map((s) => ({
                organizationId,
                category: s.category,
                subtype: s.subtype,
                groupLabel: s.groupLabel ?? null,
              })),
            },
          },
        }),
      ]);
    } else {
      await prisma.opsClient.update({ where: { id: clientId }, data });
    }

    return this.getClient(organizationId, clientId);
  },

  async deleteClient(organizationId: string, clientId: string) {
    await requireOpsClient(organizationId, clientId);
    await prisma.opsClient.update({
      where: { id: clientId },
      data: { deletedAt: new Date() },
    });
    return { ok: true };
  },

  async listPayments(organizationId: string, monthKey?: string) {
    const rows = await prisma.opsPayment.findMany({
      where: {
        organizationId,
        deletedAt: null,
        ...(monthKey
          ? {
              OR: [
                { monthKey },
                { paidAt: null },
                {
                  paidAt: { not: null },
                  monthKey,
                },
              ],
            }
          : {}),
      },
      include: { client: { select: { id: true, name: true } } },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
    });

    // For collections view: unpaid always + paid in selected month.
    const filtered = monthKey
      ? rows.filter((r) => !r.paidAt || r.monthKey === monthKey)
      : rows;

    return filtered.map(serializePayment);
  },

  async createPayment(organizationId: string, body: CreateOpsPaymentBody) {
    await requireOpsClient(organizationId, body.clientId);
    const dueDate = dateOnly(body.dueDate ?? null);
    const monthKey =
      body.monthKey ??
      (dueDate ? monthKeyFromDate(dueDate) : monthKeyFromDate(new Date()));
    const paidAt = body.markPaid ? new Date() : null;

    const row = await prisma.opsPayment.create({
      data: {
        organizationId,
        clientId: body.clientId,
        amount: body.amount ?? null,
        description: body.description ?? null,
        dueDate,
        paidAt,
        monthKey,
      },
      include: { client: { select: { id: true, name: true } } },
    });
    return serializePayment(row);
  },

  async updatePayment(organizationId: string, paymentId: string, body: UpdateOpsPaymentBody) {
    const existing = await prisma.opsPayment.findFirst({
      where: { id: paymentId, organizationId, deletedAt: null },
    });
    if (!existing) throw new HttpError(404, 'Payment not found');

    let paidAt = existing.paidAt;
    if (body.markPaid === true) paidAt = new Date();
    if (body.markPaid === false) paidAt = null;
    if (body.paidAt !== undefined) {
      paidAt = body.paidAt ? new Date(body.paidAt) : null;
    }

    const dueDate =
      body.dueDate !== undefined ? dateOnly(body.dueDate) : existing.dueDate;
    const monthKey =
      body.monthKey ??
      (dueDate ? monthKeyFromDate(dueDate) : existing.monthKey);

    const row = await prisma.opsPayment.update({
      where: { id: paymentId },
      data: {
        amount: body.amount !== undefined ? body.amount : undefined,
        description: body.description !== undefined ? body.description : undefined,
        dueDate: body.dueDate !== undefined ? dueDate : undefined,
        monthKey,
        paidAt,
      },
      include: { client: { select: { id: true, name: true } } },
    });
    return serializePayment(row);
  },

  async deletePayment(organizationId: string, paymentId: string) {
    const existing = await prisma.opsPayment.findFirst({
      where: { id: paymentId, organizationId, deletedAt: null },
    });
    if (!existing) throw new HttpError(404, 'Payment not found');
    await prisma.opsPayment.update({
      where: { id: paymentId },
      data: { deletedAt: new Date() },
    });
    return { ok: true };
  },

  async dashboard(organizationId: string, monthKey: string) {
    const clients = await prisma.opsClient.findMany({
      where: { organizationId, deletedAt: null },
      include: { services: true },
    });
    const payments = await prisma.opsPayment.findMany({
      where: { organizationId, deletedAt: null },
      include: { client: { select: { id: true, name: true } } },
    });

    const active = clients.filter((c) => c.status === 'active');
    const retainerClients = clients.filter(
      (c) => c.engagementType === 'retainer' && c.status !== 'lost' && c.status !== 'completed'
    );
    const monthlyRetainer = retainerClients.reduce((sum, c) => sum + money(c.monthlyFee), 0);

    const unpaid = payments.filter((p) => !p.paidAt);
    const monthUnpaid = unpaid.filter((p) => p.monthKey === monthKey);
    const monthPaid = payments.filter((p) => p.paidAt && p.monthKey === monthKey);
    const overdue = unpaid.filter((p) => {
      const d = daysFromToday(p.dueDate);
      return d != null && d < 0;
    });

    const toCollect = monthUnpaid.reduce((s, p) => s + money(p.amount), 0);
    const collected = monthPaid.reduce((s, p) => s + money(p.amount), 0);
    const overdueAmount = overdue.reduce((s, p) => s + money(p.amount), 0);

    const today = startOfUtcDaySafe(new Date());
    const in14 = new Date(today.getTime() + 14 * 86_400_000);
    const collectionsDue = unpaid
      .filter((p) => {
        if (!p.dueDate) return false;
        const d = startOfUtcDaySafe(p.dueDate);
        return d.getTime() <= in14.getTime();
      })
      .sort((a, b) => (a.dueDate!.getTime() - b.dueDate!.getTime()))
      .slice(0, 20)
      .map(serializePayment);

    const renewals = clients
      .filter((c) => c.retainerStart && c.retainerMonths && c.status !== 'lost')
      .map((c) => {
        const end = addMonths(c.retainerStart!, c.retainerMonths!);
        const days = daysFromToday(end);
        return { client: serializeClient(c), endsOn: end.toISOString().slice(0, 10), daysLeft: days };
      })
      .filter((r) => r.daysLeft != null && r.daysLeft <= 30)
      .sort((a, b) => (a.daysLeft ?? 0) - (b.daysLeft ?? 0));

    const escalations = clients.filter(
      (c) => c.escalation && c.escalation !== 'None' && c.status !== 'lost' && c.status !== 'completed'
    ).length;

    const delays = monthPaid
      .filter((p) => p.dueDate && p.paidAt)
      .map((p) => {
        const due = startOfUtcDaySafe(p.dueDate!);
        const paid = startOfUtcDaySafe(p.paidAt!);
        return Math.max(0, Math.round((paid.getTime() - due.getTime()) / 86_400_000));
      });
    const avgDelay =
      delays.length > 0 ? Math.round(delays.reduce((a, b) => a + b, 0) / delays.length) : null;

    const statusCounts = Object.fromEntries(
      OPS_CLIENT_STATUSES.map((s) => [s, clients.filter((c) => c.status === s).length])
    ) as Record<OpsClientStatus, number>;

    const serviceSummary = OPS_SERVICE_CATEGORIES.map((category) => {
      const rows = clients.flatMap((c) =>
        c.services.filter((s) => s.category === category).map((s) => ({
          clientId: c.id,
          subtype: s.subtype,
          groupLabel: s.groupLabel,
        }))
      );
      const clientIds = new Set(rows.map((r) => r.clientId));
      const map = new Map<string, { subtype: string; groupLabel: string | null; clients: Set<string> }>();
      for (const row of rows) {
        const key = `${row.groupLabel ?? ''}::${row.subtype}`;
        const cur = map.get(key) ?? {
          subtype: row.subtype,
          groupLabel: row.groupLabel,
          clients: new Set<string>(),
        };
        cur.clients.add(row.clientId);
        map.set(key, cur);
      }
      return {
        category,
        totalClients: clientIds.size,
        subtypes: [...map.values()].map((v) => ({
          groupLabel: v.groupLabel,
          subtype: v.subtype,
          count: v.clients.size,
        })),
      };
    });

    return {
      monthKey,
      kpis: {
        activeClients: active.length,
        totalClients: clients.length,
        monthlyRetainer,
        retainerClientCount: retainerClients.length,
        toCollect,
        toCollectCount: monthUnpaid.length,
        collected,
        collectedCount: monthPaid.length,
        overdueAmount,
        overdueCount: overdue.length,
        renewalsDue: renewals.length,
        openEscalations: escalations,
        avgCollectionDelayDays: avgDelay,
      },
      statusCounts,
      collectionsDue,
      renewals,
      serviceSummary,
    };
  },

  async servicesView(organizationId: string, category: OpsServiceCategory, monthKey: string) {
    const clients = await prisma.opsClient.findMany({
      where: {
        organizationId,
        deletedAt: null,
        services: { some: { category } },
      },
      include: {
        services: { where: { category }, orderBy: { subtype: 'asc' } },
      },
      orderBy: { name: 'asc' },
    });

    const serialized = clients.map(serializeClient);
    const active = serialized.filter((c) => c.status === 'active');
    const withFee = serialized.filter((c) => c.monthlyFee != null && c.monthlyFee > 0);
    const monthlyFee = withFee.reduce((s, c) => s + (c.monthlyFee ?? 0), 0);
    const escalations = serialized.filter(
      (c) => c.escalation && c.escalation !== 'None'
    ).length;
    const workDelayed = serialized.filter(
      (c) => c.workStatus && /delay|delayed|blocked/i.test(c.workStatus)
    ).length;

    const subtypeMap = new Map<string, number>();
    for (const c of serialized) {
      for (const s of c.services) {
        subtypeMap.set(s.subtype, (subtypeMap.get(s.subtype) ?? 0) + 1);
      }
    }
    // Clients with no subtype under this category counted as Not specified — already filtered by some.
    const unspecified = serialized.filter((c) => c.services.length === 0).length;

    return {
      monthKey,
      category,
      kpis: {
        totalClients: serialized.length,
        activeClients: active.length,
        monthlyFee,
        feeEnteredCount: withFee.length,
        escalations,
        workDelayed,
      },
      subtypes: [
        ...[...subtypeMap.entries()].map(([subtype, count]) => ({ subtype, count })),
        ...(unspecified ? [{ subtype: 'Not specified', count: unspecified }] : []),
      ],
      clients: serialized,
    };
  },
};

function startOfUtcDaySafe(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}
