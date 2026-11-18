import 'server-only';
import type { Prisma } from '@/generated/prisma/client';
import { decrypt } from '@/shared/lib/crypto';
import { prisma } from '@/shared/lib/prisma';
import { HttpError } from '@/shared/server/http-error';
import { workerScope } from '../growth/growth-scope';
import { normalizeShopDomain } from '../growth/shopify.client';
import {
  ORDER_FLOW_BY_KEY,
  ORDER_FLOW_RECOVERY_WINDOW_DAYS,
  type OrderFlowKey,
} from '../../config/order-flows';
import type { OrderFlowOnlyIf, OrderFlowStopIf, OrderFlowVariableMap } from '../../types/order-flow';
import { orderFlowRepository } from '../whatsapp/order-flow.repository';
import { orderFlowSender } from '../whatsapp/order-flow-sender';
import {
  acceptsMarketing,
  buildTemplateVariables,
  cartTotalFromPayload,
  extractCustomerName,
  extractEmailFromPayload,
  extractPhoneFromPayload,
  isCodOrder,
  type ShopifyOrderLike,
} from '../whatsapp/order-flow-variables';
import { toWaId } from '../whatsapp/wa-id';
import { verifyShopifyWebhookSignature } from './shopify-webhook-signature';

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
    if (typeof v === 'string') out[k] = v;
  }
  return out;
}

function delayMs(value: number | null | undefined, unit: string | null | undefined): number {
  if (value == null || value <= 0) return 0;
  if (unit === 'hours') return value * 3_600_000;
  if (unit === 'days') return value * 86_400_000;
  return value * 60_000;
}

function resourceIdFrom(topic: string, payload: ShopifyOrderLike): string | null {
  if (topic.startsWith('checkouts/')) {
    return String(payload.token || payload.id || '') || null;
  }
  if (topic === 'fulfillments/create') {
    return String(payload.id || payload.order_id || '') || null;
  }
  if (topic === 'refunds/create') {
    return String(payload.id || payload.order_id || '') || null;
  }
  return String(payload.id || payload.order_id || '') || null;
}

function orderLabelFrom(payload: ShopifyOrderLike): string | null {
  const name = String(payload.name || payload.order_number || '').trim();
  if (name) return name.startsWith('#') ? name : `#${name}`;
  const total = cartTotalFromPayload(payload);
  if (total != null) return `Cart ₹${total}`;
  return null;
}

function passesOnlyIf(
  onlyIf: OrderFlowOnlyIf,
  payload: ShopifyOrderLike,
  cod: boolean
): boolean {
  if (onlyIf.minCartValue != null) {
    const total = cartTotalFromPayload(payload);
    if (total == null || total < onlyIf.minCartValue) return false;
  }
  if (onlyIf.paymentType === 'cod' && !cod) return false;
  if (onlyIf.paymentType === 'prepaid' && cod) return false;
  return true;
}

async function hasOptedOut(organizationId: string, phoneDigits: string): Promise<boolean> {
  const conversation = await prisma.whatsAppConversation.findFirst({
    where: { organizationId, waId: phoneDigits, optedOutAt: { not: null } },
    select: { id: true },
  });
  return Boolean(conversation);
}

async function scheduleOrSend(input: {
  store: {
    id: string;
    organizationId: string;
    customerId: string;
    shopName: string | null;
    shopDomain: string;
    orderFlowsPaused: boolean;
  };
  flowKey: OrderFlowKey;
  payload: ShopifyOrderLike;
  orderId?: string | null;
  checkoutToken?: string | null;
  dedupeSuffix?: string;
  forceImmediate?: boolean;
}): Promise<'scheduled' | 'sent' | 'skipped' | 'duplicate' | 'paused'> {
  if (input.store.orderFlowsPaused) return 'paused';

  const flows = await orderFlowRepository.ensureFlowsForStore(input.store);
  const flow = flows.find((f) => f.flowKey === input.flowKey);
  if (!flow || !flow.enabled || !flow.templateName || !flow.templateLanguage) {
    return 'skipped';
  }

  const def = ORDER_FLOW_BY_KEY[input.flowKey];
  const onlyIf = parseOnlyIf(flow.onlyIf);
  const stopIf = parseStopIf(flow.stopIf);
  const cod = isCodOrder(input.payload);
  if (!passesOnlyIf(onlyIf, input.payload, cod)) {
    return 'skipped';
  }

  const phoneRaw = extractPhoneFromPayload(input.payload);
  const phone = toWaId(phoneRaw);
  const resourceId =
    input.checkoutToken ||
    input.orderId ||
    resourceIdFrom(def.shopifyTopics[0] ?? '', input.payload) ||
    'unknown';
  const dedupeKey = `${input.store.id}:${input.flowKey}:${resourceId}${
    input.dedupeSuffix ? `:${input.dedupeSuffix}` : ''
  }`.slice(0, 160);

  if (!phone) {
    await orderFlowRepository.createMessage({
      organizationId: input.store.organizationId,
      customerId: input.store.customerId,
      storeId: input.store.id,
      flowId: flow.id,
      flowKey: input.flowKey,
      status: 'skipped',
      statusReason: 'no_phone',
      phone: null,
      customerName: extractCustomerName(input.payload),
      orderLabel: orderLabelFrom(input.payload),
      orderId: input.orderId ?? null,
      checkoutToken: input.checkoutToken ?? null,
      cartTotal: cartTotalFromPayload(input.payload),
      currency: typeof input.payload.currency === 'string' ? input.payload.currency : null,
      dedupeKey,
      dueAt: new Date(),
    });
    return 'skipped';
  }

  if (def.marketingHours) {
    if (!acceptsMarketing(input.payload)) {
      await orderFlowRepository.createMessage({
        organizationId: input.store.organizationId,
        customerId: input.store.customerId,
        storeId: input.store.id,
        flowId: flow.id,
        flowKey: input.flowKey,
        status: 'skipped',
        statusReason: 'no_marketing_consent',
        phone,
        customerName: extractCustomerName(input.payload),
        orderLabel: orderLabelFrom(input.payload),
        orderId: input.orderId ?? null,
        checkoutToken: input.checkoutToken ?? null,
        cartTotal: cartTotalFromPayload(input.payload),
        currency: typeof input.payload.currency === 'string' ? input.payload.currency : null,
        dedupeKey,
        dueAt: new Date(),
      });
      return 'skipped';
    }
    if (stopIf.onStopReply !== false && (await hasOptedOut(input.store.organizationId, phone))) {
      await orderFlowRepository.createMessage({
        organizationId: input.store.organizationId,
        customerId: input.store.customerId,
        storeId: input.store.id,
        flowId: flow.id,
        flowKey: input.flowKey,
        status: 'skipped',
        statusReason: 'stop_reply',
        phone,
        customerName: extractCustomerName(input.payload),
        orderLabel: orderLabelFrom(input.payload),
        orderId: input.orderId ?? null,
        checkoutToken: input.checkoutToken ?? null,
        cartTotal: cartTotalFromPayload(input.payload),
        currency: typeof input.payload.currency === 'string' ? input.payload.currency : null,
        dedupeKey,
        dueAt: new Date(),
      });
      return 'skipped';
    }
  }

  const waitMs = input.forceImmediate
    ? 0
    : delayMs(flow.delayValue, flow.delayUnit) ||
      delayMs(def.defaultDelay?.value ?? 0, def.defaultDelay?.unit ?? 'minutes');
  const dueAt = new Date(Date.now() + waitMs);

  const message = await orderFlowRepository.createMessage({
    organizationId: input.store.organizationId,
    customerId: input.store.customerId,
    storeId: input.store.id,
    flowId: flow.id,
    flowKey: input.flowKey,
    status: 'waiting',
    phone,
    customerName: extractCustomerName(input.payload),
    orderLabel: orderLabelFrom(input.payload),
    orderId: input.orderId ?? null,
    checkoutToken: input.checkoutToken ?? null,
    cartTotal: cartTotalFromPayload(input.payload),
    currency: typeof input.payload.currency === 'string' ? input.payload.currency : null,
    dedupeKey,
    dueAt,
  });
  if (!message) return 'duplicate';

  // Immediate utility messages send now; delayed ones wait for the worker.
  if (waitMs > 0) return 'scheduled';

  const storeName = input.store.shopName || input.store.shopDomain;
  // Reminder 2 may put a literal discount code in variableMap (no Shopify code creation).
  const { variables, buttonUrlParams } = buildTemplateVariables(
    parseVariableMap(flow.variableMap),
    input.payload,
    storeName
  );

  const result = await orderFlowSender.sendTemplate({
    scope: workerScope(input.store.organizationId, input.store.customerId),
    storeId: input.store.id,
    messageId: message.id,
    to: phone,
    templateName: flow.templateName,
    language: flow.templateLanguage,
    variables: variables.length ? variables : [extractCustomerName(input.payload) || 'there'],
    buttonUrlParams,
  });
  return result.ok ? 'sent' : 'skipped';
}

async function handleOrdersCreate(
  store: Parameters<typeof scheduleOrSend>[0]['store'],
  payload: ShopifyOrderLike
) {
  const orderId = String(payload.id || '');
  const checkoutToken =
    typeof payload.checkout_token === 'string' ? payload.checkout_token : null;
  const phone = toWaId(extractPhoneFromPayload(payload));

  await orderFlowRepository.cancelAbandonedForIdentity({
    storeId: store.id,
    email: extractEmailFromPayload(payload),
    phone,
    checkoutToken,
  });
  await orderFlowRepository.markRecovered({
    storeId: store.id,
    phone,
    checkoutToken,
    orderTotal: cartTotalFromPayload(payload),
    orderLabel: orderLabelFrom(payload),
    withinDays: ORDER_FLOW_RECOVERY_WINDOW_DAYS,
  });

  const cod = isCodOrder(payload);
  if (cod) {
    await scheduleOrSend({
      store,
      flowKey: 'order_confirmed_cod',
      payload,
      orderId,
      checkoutToken,
      forceImmediate: true,
    });
  } else {
    await scheduleOrSend({
      store,
      flowKey: 'order_confirmed_prepaid',
      payload,
      orderId,
      checkoutToken,
      forceImmediate: true,
    });
  }
}

async function handleOrdersPaid(
  store: Parameters<typeof scheduleOrSend>[0]['store'],
  payload: ShopifyOrderLike
) {
  const orderId = String(payload.id || '');
  await scheduleOrSend({
    store,
    flowKey: 'payment_received',
    payload,
    orderId,
    forceImmediate: true,
  });
  // Prepaid confirm if not already sent (e.g. paid webhook without create, or race).
  if (!isCodOrder(payload)) {
    await scheduleOrSend({
      store,
      flowKey: 'order_confirmed_prepaid',
      payload,
      orderId,
      forceImmediate: true,
    });
  }
}

async function handleFulfillment(
  store: Parameters<typeof scheduleOrSend>[0]['store'],
  payload: ShopifyOrderLike
) {
  const orderId = String(payload.order_id || payload.id || '');
  await scheduleOrSend({
    store,
    flowKey: 'order_shipped',
    payload,
    orderId,
    forceImmediate: true,
  });
}

async function handleCancelled(
  store: Parameters<typeof scheduleOrSend>[0]['store'],
  payload: ShopifyOrderLike
) {
  await scheduleOrSend({
    store,
    flowKey: 'order_cancelled',
    payload,
    orderId: String(payload.id || ''),
    forceImmediate: true,
  });
}

async function handleRefund(
  store: Parameters<typeof scheduleOrSend>[0]['store'],
  payload: ShopifyOrderLike
) {
  await scheduleOrSend({
    store,
    flowKey: 'refund_done',
    payload,
    orderId: String(payload.order_id || payload.id || ''),
    forceImmediate: true,
  });
}

async function handleCheckout(
  store: Parameters<typeof scheduleOrSend>[0]['store'],
  payload: ShopifyOrderLike
) {
  // Skip completed checkouts / already converted.
  if (payload.completed_at) return;
  const token = String(payload.token || payload.id || '');
  if (!token) return;

  await scheduleOrSend({
    store,
    flowKey: 'abandoned_checkout_1',
    payload,
    checkoutToken: token,
  });
  await scheduleOrSend({
    store,
    flowKey: 'abandoned_checkout_2',
    payload,
    checkoutToken: token,
  });
}

async function handleFulfilled(
  store: Parameters<typeof scheduleOrSend>[0]['store'],
  payload: ShopifyOrderLike
) {
  await scheduleOrSend({
    store,
    flowKey: 'review_request',
    payload,
    orderId: String(payload.id || ''),
  });
}

export const shopifyWebhookService = {
  /**
   * Ingest a Shopify webhook: verify HMAC, dedupe by webhook id, dispatch flows.
   * Always safe to call; duplicate webhook ids are ignored.
   */
  async ingest(input: {
    rawBody: string;
    shopDomainHeader: string | null;
    hmacHeader: string | null;
    topicHeader: string | null;
    webhookIdHeader: string | null;
  }): Promise<{ ok: true; duplicate?: boolean; topic?: string }> {
    if (!input.shopDomainHeader?.trim()) {
      throw new HttpError(400, 'Missing X-Shopify-Shop-Domain');
    }
    if (!input.topicHeader?.trim()) {
      throw new HttpError(400, 'Missing X-Shopify-Topic');
    }
    if (!input.webhookIdHeader?.trim()) {
      throw new HttpError(400, 'Missing X-Shopify-Webhook-Id');
    }

    let shopDomain: string;
    try {
      shopDomain = normalizeShopDomain(input.shopDomainHeader);
    } catch {
      throw new HttpError(400, 'Invalid shop domain');
    }

    const store = await orderFlowRepository.findStoreByShopDomain(shopDomain);
    if (!store) {
      throw new HttpError(404, 'Unknown shop');
    }
    if (!store.clientSecretEncrypted) {
      throw new HttpError(500, 'Store has no client secret for webhook verification');
    }

    const secret = decrypt(store.clientSecretEncrypted);
    verifyShopifyWebhookSignature(input.rawBody, input.hmacHeader, secret);

    let payload: ShopifyOrderLike;
    try {
      payload = JSON.parse(input.rawBody) as ShopifyOrderLike;
    } catch {
      throw new HttpError(400, 'Invalid JSON body');
    }

    const topic = input.topicHeader.trim();
    const shopifyWebhookId = input.webhookIdHeader.trim();
    const resourceId = resourceIdFrom(topic, payload);

    try {
      await prisma.socialShopifyWebhookEvent.create({
        data: {
          organizationId: store.organizationId,
          customerId: store.customerId,
          storeId: store.id,
          shopifyWebhookId,
          topic,
          shopDomain,
          resourceId,
          payload: payload as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        (error as { code?: string }).code === 'P2002'
      ) {
        return { ok: true, duplicate: true, topic };
      }
      throw error;
    }

    await prisma.socialShopifyStore.update({
      where: { id: store.id },
      data: { lastWebhookAt: new Date() },
    });

    const storeCtx = {
      id: store.id,
      organizationId: store.organizationId,
      customerId: store.customerId,
      shopName: store.shopName,
      shopDomain: store.shopDomain,
      orderFlowsPaused: store.orderFlowsPaused,
    };

    switch (topic) {
      case 'orders/create':
        await handleOrdersCreate(storeCtx, payload);
        break;
      case 'orders/paid':
        await handleOrdersPaid(storeCtx, payload);
        break;
      case 'fulfillments/create':
        await handleFulfillment(storeCtx, payload);
        break;
      case 'orders/cancelled':
        await handleCancelled(storeCtx, payload);
        break;
      case 'refunds/create':
        await handleRefund(storeCtx, payload);
        break;
      case 'checkouts/create':
      case 'checkouts/update':
        await handleCheckout(storeCtx, payload);
        break;
      case 'orders/fulfilled':
        await handleFulfilled(storeCtx, payload);
        break;
      default:
        break;
    }

    await prisma.socialShopifyWebhookEvent.update({
      where: { shopifyWebhookId },
      data: { processedAt: new Date() },
    });

    return { ok: true, topic };
  },
};

/** Exported for the order-flow worker to re-send due messages. */
export async function sendDueOrderFlowMessage(messageId: string): Promise<void> {
  const message = await prisma.socialWhatsAppOrderMessage.findUnique({ where: { id: messageId } });
  if (!message || message.status !== 'waiting') return;

  const store = await prisma.socialShopifyStore.findUnique({ where: { id: message.storeId } });
  if (!store) return;
  if (store.orderFlowsPaused) {
    await orderFlowRepository.updateMessage(message.id, {
      status: 'skipped',
      statusReason: 'flows_paused',
    });
    return;
  }

  const flow = await prisma.socialWhatsAppOrderFlow.findUnique({ where: { id: message.flowId } });
  if (!flow?.enabled || !flow.templateName || !flow.templateLanguage) {
    await orderFlowRepository.updateMessage(message.id, {
      status: 'cancelled',
      statusReason: 'flow_disabled',
    });
    return;
  }

  const def = ORDER_FLOW_BY_KEY[message.flowKey as OrderFlowKey];
  if (def?.marketingHours) {
    // Cancel if order already placed for this checkout.
    if (message.checkoutToken) {
      const stillWaiting = message.status === 'waiting';
      if (stillWaiting) {
        // If an order message exists for same checkout, cancel.
        const ordered = await prisma.socialWhatsAppOrderMessage.findFirst({
          where: {
            storeId: message.storeId,
            checkoutToken: message.checkoutToken,
            flowKey: { in: ['order_confirmed_prepaid', 'order_confirmed_cod'] },
            status: { in: ['sent', 'delivered', 'read', 'waiting'] },
          },
          select: { id: true },
        });
        if (ordered) {
          await orderFlowRepository.updateMessage(message.id, {
            status: 'cancelled',
            statusReason: 'order_placed',
          });
          return;
        }
      }
    }
  }

  // Payload is not stored on the message; use a minimal reconstruct for variables.
  const payload: ShopifyOrderLike = {
    phone: message.phone,
    name: message.orderLabel,
    id: message.orderId,
    token: message.checkoutToken,
    total_price: message.cartTotal?.toString() ?? undefined,
    currency: message.currency,
    customer: { first_name: message.customerName?.split(' ')[0], phone: message.phone },
  };

  const event = await prisma.socialShopifyWebhookEvent.findFirst({
    where: {
      storeId: message.storeId,
      ...(message.checkoutToken
        ? { resourceId: message.checkoutToken }
        : message.orderId
          ? { resourceId: message.orderId }
          : {}),
    },
    orderBy: { createdAt: 'desc' },
  });
  const fullPayload = (event?.payload as ShopifyOrderLike | undefined) ?? payload;

  if (!message.phone) {
    await orderFlowRepository.updateMessage(message.id, {
      status: 'skipped',
      statusReason: 'no_phone',
    });
    return;
  }

  if (def?.marketingHours && (await hasOptedOut(store.organizationId, message.phone))) {
    await orderFlowRepository.updateMessage(message.id, {
      status: 'skipped',
      statusReason: 'stop_reply',
    });
    return;
  }

  const storeName = store.shopName || store.shopDomain;
  const { variables, buttonUrlParams } = buildTemplateVariables(
    parseVariableMap(flow.variableMap),
    fullPayload,
    storeName
  );

  await orderFlowSender.sendTemplate({
    scope: workerScope(store.organizationId, store.customerId),
    storeId: store.id,
    messageId: message.id,
    to: message.phone,
    templateName: flow.templateName,
    language: flow.templateLanguage,
    variables: variables.length
      ? variables
      : [message.customerName?.split(' ')[0] || 'there'],
    buttonUrlParams,
  });
}
