import 'server-only';
import { prisma } from '@/shared/lib/prisma';
import { singleAssignedCustomerId, type ClientScope } from '@/shared/server/client-scope';
import { HttpError } from '@/shared/server/http-error';
import {
  ORDER_FLOW_BY_KEY,
  ORDER_FLOW_DEFINITIONS,
  ORDER_FLOW_KEYS,
  type OrderFlowDelayUnit,
  type OrderFlowKey,
} from '../../config/order-flows';
import type {
  OrderFlowActivityResponse,
  OrderFlowDetail,
  OrderFlowListItem,
  OrderFlowListResponse,
  OrderFlowOnlyIf,
  OrderFlowResultsResponse,
  OrderFlowRow,
  OrderFlowStopIf,
  OrderFlowTestSendResult,
  OrderFlowVariableMap,
} from '../../types/order-flow';
import { toWaId } from './wa-id';
import { orderFlowRepository } from './order-flow.repository';
import type {
  ListOrderFlowActivityInput,
  ListOrderFlowResultsInput,
  PatchOrderFlowInput,
  TestOrderFlowSendInput,
} from './order-flow.schema';
import { buildSampleTemplateVariables } from './order-flow-variables';
import { orderFlowSender } from './order-flow-sender';
import { whatsappService } from './whatsapp.service';

function requireSingleClient(scope: ClientScope): string {
  const customerId = singleAssignedCustomerId(scope);
  if (!customerId) {
    throw new HttpError(400, 'Pick a client in the client switcher first.');
  }
  return customerId;
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function parseOnlyIf(value: unknown): OrderFlowOnlyIf {
  const o = asObject(value);
  return {
    minCartValue: typeof o.minCartValue === 'number' ? o.minCartValue : null,
    paymentType:
      o.paymentType === 'cod' || o.paymentType === 'prepaid' || o.paymentType === 'any'
        ? o.paymentType
        : 'any',
  };
}

function parseOnlyIfOrNull(value: unknown): OrderFlowOnlyIf | null {
  if (value == null) return null;
  const o = asObject(value);
  if (Object.keys(o).length === 0) return null;
  return parseOnlyIf(value);
}

function parseStopIf(value: unknown): OrderFlowStopIf {
  const o = asObject(value);
  return {
    onOrderPlaced: o.onOrderPlaced !== false,
    onStopReply: o.onStopReply !== false,
  };
}

function parseVariableMap(value: unknown): OrderFlowVariableMap {
  const o = asObject(value);
  const out: OrderFlowVariableMap = {};
  for (const [k, v] of Object.entries(o)) {
    if (typeof v === 'string' || v === null) out[k] = v;
  }
  return out;
}

function parseVariableMapOrNull(value: unknown): OrderFlowVariableMap | null {
  if (value == null) return null;
  return parseVariableMap(value);
}

function toRow(
  item: OrderFlowListItem,
  extras?: {
    onlyIf?: OrderFlowOnlyIf | null;
    variableMap?: OrderFlowVariableMap | null;
    stopIf?: OrderFlowStopIf;
  }
): OrderFlowRow {
  const deliveredPct =
    item.sent30d > 0 ? Math.round((item.delivered30d / item.sent30d) * 100) : null;
  return {
    key: item.flowKey,
    group: item.group,
    label: item.label,
    when: item.when,
    enabled: item.enabled,
    templateName: item.templateName,
    templateLanguage: item.templateLanguage,
    delayValue: item.delayValue,
    delayUnit: item.delayUnit,
    onlyIf: extras?.onlyIf ?? null,
    variableMap: extras?.variableMap ?? null,
    stopIf: extras?.stopIf ?? { onOrderPlaced: true, onStopReply: true },
    sent30d: item.sent30d,
    deliveredPct,
    recovered30d: item.group === 'recover_sales' ? item.recovered30d : null,
    revenue30d: item.group === 'recover_sales' ? item.revenue30d : null,
  };
}

function num(v: { toNumber(): number } | null | undefined): number | null {
  return v == null ? null : v.toNumber();
}

async function loadStoreOrThrow(scope: ClientScope) {
  const customerId = requireSingleClient(scope);
  const store = await orderFlowRepository.findStoreForCustomer(scope.organizationId, customerId);
  if (!store) {
    throw new HttpError(404, 'Connect a Shopify store for this client first.');
  }
  return store;
}

function toDetail(row: {
  flowKey: string;
  enabled: boolean;
  templateName: string | null;
  templateLanguage: string | null;
  delayValue: number | null;
  delayUnit: string | null;
  onlyIf: unknown;
  variableMap: unknown;
  stopIf: unknown;
}): OrderFlowDetail {
  const key = row.flowKey as OrderFlowKey;
  const def = ORDER_FLOW_BY_KEY[key];
  return {
    flowKey: key,
    key,
    group: def.group,
    label: def.label,
    when: def.when,
    enabled: row.enabled,
    templateName: row.templateName,
    templateLanguage: row.templateLanguage,
    delayValue: row.delayValue,
    delayUnit: (row.delayUnit as OrderFlowDelayUnit | null) ?? null,
    onlyIf: parseOnlyIf(row.onlyIf),
    variableMap: parseVariableMap(row.variableMap),
    stopIf: parseStopIf(row.stopIf),
    marketingHours: def.marketingHours,
    defaultDelay: def.defaultDelay,
  };
}

function emptyStoreStatus(): OrderFlowListResponse['store'] {
  return {
    connected: false,
    shopDomain: null,
    shopName: null,
    webhooksEnabled: false,
    lastWebhookAt: null,
    orderFlowsPaused: false,
    orderFlowsPausedReason: null,
    consecutiveSendFailures: 0,
  };
}

function wrapList(
  store: OrderFlowListResponse['store'],
  flows: OrderFlowListItem[],
  rowExtras?: Map<
    string,
    {
      onlyIf: OrderFlowOnlyIf | null;
      variableMap: OrderFlowVariableMap | null;
      stopIf: OrderFlowStopIf;
    }
  >
): OrderFlowListResponse {
  const rows = flows.map((f) => toRow(f, rowExtras?.get(f.flowKey)));
  return {
    store,
    shopName: store.shopName,
    shopDomain: store.shopDomain,
    flows,
    groups: {
      order_updates: rows.filter((r) => r.group === 'order_updates'),
      recover_sales: rows.filter((r) => r.group === 'recover_sales'),
    },
  };
}

export const orderFlowService = {
  async listFlows(scope: ClientScope): Promise<OrderFlowListResponse> {
    const customerId = requireSingleClient(scope);
    const store = await orderFlowRepository.findStoreForCustomer(scope.organizationId, customerId);
    if (!store) {
      const flows = ORDER_FLOW_DEFINITIONS.map((def) => ({
        flowKey: def.key,
        group: def.group,
        label: def.label,
        when: def.when,
        enabled: false,
        templateName: null,
        templateLanguage: null,
        delayValue: def.defaultDelay?.value ?? null,
        delayUnit: def.defaultDelay?.unit ?? null,
        marketingHours: def.marketingHours,
        sent30d: 0,
        delivered30d: 0,
        recovered30d: 0,
        revenue30d: 0,
      }));
      return wrapList(emptyStoreStatus(), flows);
    }

    const flows = await orderFlowRepository.ensureFlowsForStore(store);
    const { rows, recovered } = await orderFlowRepository.stats30d(store.id);
    const sentByKey = new Map<string, number>();
    const deliveredByKey = new Map<string, number>();
    for (const row of rows) {
      if (['sent', 'delivered', 'read'].includes(row.status)) {
        sentByKey.set(row.flowKey, (sentByKey.get(row.flowKey) ?? 0) + row._count._all);
      }
      if (['delivered', 'read'].includes(row.status)) {
        deliveredByKey.set(row.flowKey, (deliveredByKey.get(row.flowKey) ?? 0) + row._count._all);
      }
    }
    const recoveredByKey = new Map(
      recovered.map((r) => [
        r.flowKey,
        {
          count: r._count._all,
          revenue: r._sum.recoveredTotal?.toNumber() ?? 0,
        },
      ])
    );

    const byKey = new Map(flows.map((f) => [f.flowKey, f]));
    const extras = new Map(
      flows.map((f) => [
        f.flowKey,
        {
          onlyIf: parseOnlyIfOrNull(f.onlyIf),
          variableMap: parseVariableMapOrNull(f.variableMap),
          stopIf: parseStopIf(f.stopIf),
        },
      ])
    );
    const listItems: OrderFlowListItem[] = ORDER_FLOW_KEYS.map((key) => {
      const def = ORDER_FLOW_BY_KEY[key];
      const row = byKey.get(key);
      return {
        flowKey: key,
        group: def.group,
        label: def.label,
        when: def.when,
        enabled: row?.enabled ?? false,
        templateName: row?.templateName ?? null,
        templateLanguage: row?.templateLanguage ?? null,
        delayValue: row?.delayValue ?? def.defaultDelay?.value ?? null,
        delayUnit: (row?.delayUnit as OrderFlowDelayUnit | null) ?? def.defaultDelay?.unit ?? null,
        marketingHours: def.marketingHours,
        sent30d: sentByKey.get(key) ?? 0,
        delivered30d: deliveredByKey.get(key) ?? 0,
        recovered30d: recoveredByKey.get(key)?.count ?? 0,
        revenue30d: recoveredByKey.get(key)?.revenue ?? 0,
      };
    });
    return wrapList(
      {
        connected: true,
        shopDomain: store.shopDomain,
        shopName: store.shopName,
        webhooksEnabled: store.webhooksEnabled,
        lastWebhookAt: store.lastWebhookAt?.toISOString() ?? null,
        orderFlowsPaused: store.orderFlowsPaused,
        orderFlowsPausedReason: store.orderFlowsPausedReason,
        consecutiveSendFailures: store.consecutiveSendFailures,
      },
      listItems,
      extras
    );
  },

  async getFlow(scope: ClientScope, flowKey: string): Promise<OrderFlowDetail> {
    if (!ORDER_FLOW_KEYS.includes(flowKey as OrderFlowKey)) {
      throw new HttpError(404, 'Unknown flow');
    }
    const store = await loadStoreOrThrow(scope);
    await orderFlowRepository.ensureFlowsForStore(store);
    const row = await orderFlowRepository.getFlow(store.id, flowKey);
    if (!row) throw new HttpError(404, 'Flow not found');
    return toDetail(row);
  },

  async updateFlow(
    scope: ClientScope,
    flowKey: string,
    input: PatchOrderFlowInput
  ): Promise<OrderFlowDetail> {
    if (!ORDER_FLOW_KEYS.includes(flowKey as OrderFlowKey)) {
      throw new HttpError(404, 'Unknown flow');
    }
    const store = await loadStoreOrThrow(scope);
    await orderFlowRepository.ensureFlowsForStore(store);
    const row = await orderFlowRepository.getFlow(store.id, flowKey);
    if (!row) throw new HttpError(404, 'Flow not found');

    const nextEnabled = input.enabled ?? row.enabled;
    const nextTemplate = input.templateName !== undefined ? input.templateName : row.templateName;
    const nextLanguage =
      input.templateLanguage !== undefined ? input.templateLanguage : row.templateLanguage;

    if (nextEnabled && (!nextTemplate || !nextLanguage)) {
      throw new HttpError(400, 'Choose an approved template before enabling this flow.');
    }

    const updated = await orderFlowRepository.updateFlow(row.id, {
      enabled: input.enabled,
      templateName: input.templateName,
      templateLanguage: input.templateLanguage,
      delayValue: input.delayValue,
      delayUnit: input.delayUnit,
      onlyIf: input.onlyIf === null ? {} : input.onlyIf,
      variableMap:
        input.variableMap === null
          ? {}
          : input.variableMap
            ? Object.fromEntries(
                Object.entries(input.variableMap).filter(([, v]) => v != null) as [
                  string,
                  string,
                ][]
              )
            : undefined,
      stopIf: input.stopIf,
    });
    return toDetail(updated);
  },

  async activity(
    scope: ClientScope,
    filters: ListOrderFlowActivityInput
  ): Promise<OrderFlowActivityResponse> {
    requireSingleClient(scope);
    const { items, total } = await orderFlowRepository.listActivity(scope, {
      flowKey: filters.flowKey,
      status: filters.status,
      from: filters.from ? new Date(filters.from) : undefined,
      to: filters.to ? new Date(filters.to) : undefined,
      limit: filters.limit,
      offset: filters.offset,
    });
    const mapped = items.map((row) => {
      const createdAt = row.createdAt.toISOString();
      return {
        id: row.id,
        time: row.sentAt?.toISOString() ?? createdAt,
        createdAt,
        dueAt: row.dueAt.toISOString(),
        sentAt: row.sentAt?.toISOString() ?? null,
        flowKey: row.flowKey as OrderFlowKey,
        flowLabel: ORDER_FLOW_BY_KEY[row.flowKey as OrderFlowKey]?.label ?? row.flowKey,
        customerName: row.customerName,
        phone: row.phone,
        orderLabel: row.orderLabel,
        cartTotal: num(row.cartTotal),
        currency: row.currency,
        status: row.status as OrderFlowActivityResponse['items'][number]['status'],
        statusReason: row.statusReason,
        resultLabel: row.resultLabel,
        recoveredTotal: num(row.recoveredTotal),
      };
    });
    return { total, items: mapped, rows: mapped };
  },

  async results(
    scope: ClientScope,
    filters: ListOrderFlowResultsInput
  ): Promise<OrderFlowResultsResponse> {
    requireSingleClient(scope);
    const to = filters.to ? new Date(filters.to) : new Date();
    const from = filters.from
      ? new Date(filters.from)
      : new Date(to.getTime() - 30 * 86_400_000);
    const { sentGroups, recoveredGroups } = await orderFlowRepository.results(scope, from, to);
    const sentMap = new Map(sentGroups.map((g) => [g.flowKey, g._count._all]));
    const recoveredMap = new Map(
      recoveredGroups.map((g) => [
        g.flowKey,
        { count: g._count._all, revenue: g._sum.recoveredTotal?.toNumber() ?? 0 },
      ])
    );
    const byFlow = ORDER_FLOW_KEYS.map((key) => ({
      key,
      flowKey: key,
      label: ORDER_FLOW_BY_KEY[key].label,
      sent: sentMap.get(key) ?? 0,
      recovered: recoveredMap.get(key)?.count ?? 0,
      revenue: recoveredMap.get(key)?.revenue ?? 0,
    }));
    const messagesSent = byFlow.reduce((n, f) => n + f.sent, 0);
    const cartsRecovered = byFlow.reduce((n, f) => n + f.recovered, 0);
    const revenueRecovered = byFlow.reduce((n, f) => n + f.revenue, 0);
    return {
      from: from.toISOString(),
      to: to.toISOString(),
      messagesSent,
      cartsRecovered,
      revenueRecovered,
      moneySpentEstimate: 0,
      estimatedMessageCost: null,
      byFlow,
    };
  },

  async sendTest(
    scope: ClientScope,
    flowKey: string,
    input: TestOrderFlowSendInput
  ): Promise<OrderFlowTestSendResult> {
    if (!ORDER_FLOW_KEYS.includes(flowKey as OrderFlowKey)) {
      throw new HttpError(404, 'Unknown flow');
    }
    const store = await loadStoreOrThrow(scope);
    const row = await orderFlowRepository.getFlow(store.id, flowKey);
    if (!row?.templateName || !row.templateLanguage) {
      throw new HttpError(400, 'Choose a template before sending a test.');
    }
    const to = toWaId(input.to);
    if (!to) throw new HttpError(400, 'Enter a valid phone number with country code.');

    const storeName = store.shopName || store.shopDomain;
    const { variables, buttonUrlParams } = buildSampleTemplateVariables(
      parseVariableMap(row.variableMap),
      storeName
    );
    // Ensure sample body has at least one placeholder value if map is empty.
    const bodyVars =
      variables.length > 0 ? variables : [ORDER_FLOW_BY_KEY[flowKey as OrderFlowKey].label];

    const result = await whatsappService.send(
      scope,
      {
        type: 'template',
        to,
        templateName: row.templateName,
        language: row.templateLanguage,
        variables: bodyVars,
        buttonUrlParams,
      },
      { senderName: 'Order flow test' }
    );
    return {
      messageId: result.messageId,
      to,
      message: 'Test message sent. Check WhatsApp on that number.',
    };
  },

  async pauseFlows(scope: ClientScope, reason?: string) {
    const store = await loadStoreOrThrow(scope);
    await orderFlowSender.pauseStore(
      store.id,
      reason?.trim() || 'Paused manually from Order flows'
    );
    return { paused: true as const };
  },

  async resumeFlows(scope: ClientScope) {
    const store = await loadStoreOrThrow(scope);
    await orderFlowSender.resumeStore(store.id);
    return { paused: false as const };
  },

  /** Used by webhook worker path when store pause flag must be checked. */
  async isPaused(storeId: string): Promise<boolean> {
    const store = await prisma.socialShopifyStore.findUnique({
      where: { id: storeId },
      select: { orderFlowsPaused: true },
    });
    return Boolean(store?.orderFlowsPaused);
  },
};
