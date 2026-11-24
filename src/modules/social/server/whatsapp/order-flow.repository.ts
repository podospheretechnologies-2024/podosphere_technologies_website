import 'server-only';
import type { Prisma, SocialWhatsAppOrderFlow, SocialWhatsAppOrderMessage } from '@/generated/prisma/client';
import { prisma } from '@/shared/lib/prisma';
import type { ClientScope } from '@/shared/server/client-scope';
import { scopeWhereRequired } from '@/shared/server/client-scope';
import {
  ORDER_FLOW_BY_KEY,
  ORDER_FLOW_KEYS,
  type OrderFlowKey,
} from '../../config/order-flows';
import type { OrderFlowOnlyIf, OrderFlowStopIf, OrderFlowVariableMap } from '../../types/order-flow';

export type OrderFlowRow = SocialWhatsAppOrderFlow;
export type OrderMessageRow = SocialWhatsAppOrderMessage;

function defaultDelay(flowKey: OrderFlowKey): { delayValue: number | null; delayUnit: string | null } {
  const d = ORDER_FLOW_BY_KEY[flowKey].defaultDelay;
  if (!d) return { delayValue: null, delayUnit: null };
  return { delayValue: d.value, delayUnit: d.unit };
}

function defaultStopIf(flowKey: OrderFlowKey): OrderFlowStopIf {
  if (flowKey.startsWith('abandoned_') || flowKey === 'review_request') {
    return { onOrderPlaced: true, onStopReply: true };
  }
  return { onOrderPlaced: false, onStopReply: true };
}

export const orderFlowRepository = {
  async findStoreForCustomer(organizationId: string, customerId: string) {
    return prisma.socialShopifyStore.findFirst({
      where: { organizationId, customerId },
    });
  },

  async findStoreByShopDomain(shopDomain: string) {
    return prisma.socialShopifyStore.findUnique({ where: { shopDomain } });
  },

  async ensureFlowsForStore(store: {
    id: string;
    organizationId: string;
    customerId: string;
  }): Promise<OrderFlowRow[]> {
    const existing = await prisma.socialWhatsAppOrderFlow.findMany({
      where: { storeId: store.id },
    });
    const byKey = new Map(existing.map((row) => [row.flowKey, row]));
    const missing = ORDER_FLOW_KEYS.filter((key) => !byKey.has(key));
    if (missing.length > 0) {
      await prisma.socialWhatsAppOrderFlow.createMany({
        data: missing.map((flowKey) => {
          const delay = defaultDelay(flowKey);
          return {
            organizationId: store.organizationId,
            customerId: store.customerId,
            storeId: store.id,
            flowKey,
            enabled: false,
            ...delay,
            onlyIf: {} as Prisma.InputJsonValue,
            variableMap: {} as Prisma.InputJsonValue,
            stopIf: defaultStopIf(flowKey) as Prisma.InputJsonValue,
          };
        }),
        skipDuplicates: true,
      });
    }
    return prisma.socialWhatsAppOrderFlow.findMany({
      where: { storeId: store.id },
      orderBy: { flowKey: 'asc' },
    });
  },

  async getFlow(storeId: string, flowKey: string): Promise<OrderFlowRow | null> {
    return prisma.socialWhatsAppOrderFlow.findUnique({
      where: { storeId_flowKey: { storeId, flowKey } },
    });
  },

  async updateFlow(
    id: string,
    data: {
      enabled?: boolean;
      templateName?: string | null;
      templateLanguage?: string | null;
      delayValue?: number | null;
      delayUnit?: string | null;
      onlyIf?: OrderFlowOnlyIf | Record<string, never>;
      variableMap?: OrderFlowVariableMap | Record<string, never>;
      stopIf?: OrderFlowStopIf;
    }
  ): Promise<OrderFlowRow> {
    return prisma.socialWhatsAppOrderFlow.update({
      where: { id },
      data: {
        ...(data.enabled !== undefined ? { enabled: data.enabled } : {}),
        ...(data.templateName !== undefined ? { templateName: data.templateName } : {}),
        ...(data.templateLanguage !== undefined ? { templateLanguage: data.templateLanguage } : {}),
        ...(data.delayValue !== undefined ? { delayValue: data.delayValue } : {}),
        ...(data.delayUnit !== undefined ? { delayUnit: data.delayUnit } : {}),
        ...(data.onlyIf !== undefined ? { onlyIf: data.onlyIf as Prisma.InputJsonValue } : {}),
        ...(data.variableMap !== undefined
          ? { variableMap: data.variableMap as Prisma.InputJsonValue }
          : {}),
        ...(data.stopIf !== undefined ? { stopIf: data.stopIf as Prisma.InputJsonValue } : {}),
      },
    });
  },

  async stats30d(storeId: string) {
    const since = new Date(Date.now() - 30 * 86_400_000);
    const rows = await prisma.socialWhatsAppOrderMessage.groupBy({
      by: ['flowKey', 'status'],
      where: { storeId, createdAt: { gte: since } },
      _count: { _all: true },
    });
    const recovered = await prisma.socialWhatsAppOrderMessage.groupBy({
      by: ['flowKey'],
      where: { storeId, recoveredAt: { gte: since } },
      _count: { _all: true },
      _sum: { recoveredTotal: true },
    });
    return { rows, recovered, since };
  },

  async listActivity(
    scope: ClientScope,
    filters: {
      flowKey?: string;
      status?: string;
      from?: Date;
      to?: Date;
      limit: number;
      offset: number;
    }
  ) {
    const where: Prisma.SocialWhatsAppOrderMessageWhereInput = {
      ...scopeWhereRequired(scope),
      ...(filters.flowKey ? { flowKey: filters.flowKey } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.from || filters.to
        ? {
            createdAt: {
              ...(filters.from ? { gte: filters.from } : {}),
              ...(filters.to ? { lte: filters.to } : {}),
            },
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      prisma.socialWhatsAppOrderMessage.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: filters.limit,
        skip: filters.offset,
      }),
      prisma.socialWhatsAppOrderMessage.count({ where }),
    ]);
    return { items, total };
  },

  async results(
    scope: ClientScope,
    from: Date,
    to: Date
  ) {
    const where: Prisma.SocialWhatsAppOrderMessageWhereInput = {
      ...scopeWhereRequired(scope),
      createdAt: { gte: from, lte: to },
    };
    const [sentGroups, recoveredGroups] = await Promise.all([
      prisma.socialWhatsAppOrderMessage.groupBy({
        by: ['flowKey'],
        where: { ...where, status: { in: ['sent', 'delivered', 'read'] } },
        _count: { _all: true },
      }),
      prisma.socialWhatsAppOrderMessage.groupBy({
        by: ['flowKey'],
        where: {
          ...scopeWhereRequired(scope),
          recoveredAt: { gte: from, lte: to },
        },
        _count: { _all: true },
        _sum: { recoveredTotal: true },
      }),
    ]);
    return { sentGroups, recoveredGroups };
  },

  async createMessage(data: {
    organizationId: string;
    customerId: string;
    storeId: string;
    flowId: string;
    flowKey: string;
    status: string;
    statusReason?: string | null;
    phone?: string | null;
    customerName?: string | null;
    orderLabel?: string | null;
    orderId?: string | null;
    checkoutToken?: string | null;
    cartTotal?: number | null;
    currency?: string | null;
    dedupeKey: string;
    dueAt: Date;
  }): Promise<OrderMessageRow | null> {
    try {
      return await prisma.socialWhatsAppOrderMessage.create({
        data: {
          organizationId: data.organizationId,
          customerId: data.customerId,
          storeId: data.storeId,
          flowId: data.flowId,
          flowKey: data.flowKey,
          status: data.status,
          statusReason: data.statusReason ?? null,
          phone: data.phone ?? null,
          customerName: data.customerName ?? null,
          orderLabel: data.orderLabel ?? null,
          orderId: data.orderId ?? null,
          checkoutToken: data.checkoutToken ?? null,
          cartTotal: data.cartTotal ?? null,
          currency: data.currency ?? null,
          dedupeKey: data.dedupeKey,
          dueAt: data.dueAt,
        },
      });
    } catch (error) {
      // Unique dedupeKey → already scheduled/sent for this event.
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        (error as { code?: string }).code === 'P2002'
      ) {
        return null;
      }
      throw error;
    }
  },

  async findDueMessages(limit = 100): Promise<OrderMessageRow[]> {
    return prisma.socialWhatsAppOrderMessage.findMany({
      where: { status: 'waiting', dueAt: { lte: new Date() } },
      orderBy: { dueAt: 'asc' },
      take: limit,
    });
  },

  async updateMessage(
    id: string,
    data: Prisma.SocialWhatsAppOrderMessageUpdateInput
  ): Promise<OrderMessageRow> {
    return prisma.socialWhatsAppOrderMessage.update({ where: { id }, data });
  },

  async cancelAbandonedForIdentity(input: {
    storeId: string;
    email?: string | null;
    phone?: string | null;
    checkoutToken?: string | null;
  }) {
    const or: Prisma.SocialWhatsAppOrderMessageWhereInput[] = [];
    if (input.checkoutToken) or.push({ checkoutToken: input.checkoutToken });
    // Match waiting abandoned reminders; phone is stored normalized digits when possible.
    if (input.phone) or.push({ phone: input.phone });
    if (or.length === 0 && !input.email) return { count: 0 };

    return prisma.socialWhatsAppOrderMessage.updateMany({
      where: {
        storeId: input.storeId,
        status: 'waiting',
        flowKey: { in: ['abandoned_checkout_1', 'abandoned_checkout_2'] },
        ...(or.length ? { OR: or } : {}),
      },
      data: { status: 'cancelled', statusReason: 'order_placed' },
    });
  },

  async markRecovered(input: {
    storeId: string;
    phone?: string | null;
    checkoutToken?: string | null;
    orderTotal: number | null;
    orderLabel: string | null;
    withinDays: number;
  }) {
    const since = new Date(Date.now() - input.withinDays * 86_400_000);
    const or: Prisma.SocialWhatsAppOrderMessageWhereInput[] = [];
    if (input.checkoutToken) or.push({ checkoutToken: input.checkoutToken });
    if (input.phone) or.push({ phone: input.phone });
    if (or.length === 0) return { count: 0 };

    const candidates = await prisma.socialWhatsAppOrderMessage.findMany({
      where: {
        storeId: input.storeId,
        flowKey: { in: ['abandoned_checkout_1', 'abandoned_checkout_2'] },
        status: { in: ['sent', 'delivered', 'read'] },
        recoveredAt: null,
        sentAt: { gte: since },
        OR: or,
      },
      orderBy: { sentAt: 'desc' },
      take: 5,
    });
    for (const row of candidates) {
      await prisma.socialWhatsAppOrderMessage.update({
        where: { id: row.id },
        data: {
          recoveredAt: new Date(),
          recoveredTotal: input.orderTotal,
          resultLabel: input.orderLabel
            ? `Ordered ${input.orderLabel}`
            : input.orderTotal != null
              ? `Ordered ₹${input.orderTotal}`
              : 'Ordered',
        },
      });
    }
    return { count: candidates.length };
  },

  async updateMessageStatusByWamid(wamid: string, status: string) {
    const mapped =
      status === 'delivered' || status === 'read' || status === 'failed' || status === 'sent'
        ? status
        : null;
    if (!mapped) return;
    await prisma.socialWhatsAppOrderMessage.updateMany({
      where: { wamid, status: { in: ['sent', 'delivered', 'read', 'waiting'] } },
      data: {
        status: mapped,
        ...(mapped === 'failed' ? { statusReason: 'delivery_failed' } : {}),
      },
    });
  },
};
