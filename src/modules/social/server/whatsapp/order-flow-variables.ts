import 'server-only';
import type { OrderFlowVariableField } from '../../config/order-flows';
import type { OrderFlowVariableMap } from '../../types/order-flow';

/** Loose Shopify order / checkout / fulfillment / refund JSON. */
export type ShopifyOrderLike = Record<string, unknown>;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function str(value: unknown, fallback = ''): string {
  if (value == null) return fallback;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return fallback;
}

function money(amount: unknown, currency?: unknown): string {
  const n = typeof amount === 'number' ? amount : Number(str(amount, ''));
  if (!Number.isFinite(n)) return str(amount, '-');
  const cur = str(currency, '').toUpperCase();
  try {
    return new Intl.NumberFormat('en-IN', {
      style: cur ? 'currency' : 'decimal',
      currency: cur || undefined,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return cur ? `${cur} ${n}` : String(n);
  }
}

function customerRecord(payload: ShopifyOrderLike): Record<string, unknown> | null {
  return asRecord(payload.customer) ?? asRecord(payload.billing_address) ?? asRecord(payload.shipping_address);
}

function lineItems(payload: ShopifyOrderLike): Record<string, unknown>[] {
  const items = asArray(payload.line_items);
  return items.map((item) => asRecord(item) ?? {}).filter(Boolean);
}

function fulfillment(payload: ShopifyOrderLike): Record<string, unknown> | null {
  if (asRecord(payload.tracking_number) || payload.tracking_url || payload.tracking_company) {
    return payload;
  }
  const fulfillments = asArray(payload.fulfillments)
    .map((f) => asRecord(f))
    .filter(Boolean) as Record<string, unknown>[];
  return fulfillments[0] ?? null;
}

/** Resolve one variable field from a Shopify webhook payload + store display name. */
export function resolveOrderFlowField(
  field: OrderFlowVariableField | string | null | undefined,
  payload: ShopifyOrderLike,
  storeName: string,
  extras?: { discountCode?: string | null }
): string {
  if (field == null || field === '') return '-';
  const customer = customerRecord(payload);
  const items = lineItems(payload);
  const firstItem = items[0] ?? null;
  const ship = fulfillment(payload);
  const currency = str(payload.currency || payload.presentment_currency, 'INR');
  const totalAmount =
    typeof payload.total_price === 'string' || typeof payload.total_price === 'number'
      ? payload.total_price
      : str(asRecord(asRecord(payload.total_price_set)?.shop_money)?.amount);

  switch (field as OrderFlowVariableField) {
    case 'customer_first_name':
      return (
        str(customer?.first_name) ||
        str(payload.buyer_first_name) ||
        str(asRecord(payload.customer)?.first_name) ||
        'there'
      );
    case 'customer_full_name': {
      const first = str(customer?.first_name);
      const last = str(customer?.last_name);
      const full = `${first} ${last}`.trim();
      return full || str(customer?.name) || str(payload.email, 'there');
    }
    case 'order_number':
      return str(payload.name || payload.order_number || payload.order_id, '-');
    case 'order_total':
      return money(totalAmount, currency);
    case 'number_of_items': {
      const count = items.reduce((n, item) => n + (Number(item.quantity) || 0), 0);
      return String(count || items.length || 0);
    }
    case 'first_product_name':
      return str(firstItem?.title || firstItem?.name, 'your order');
    case 'payment_type': {
      const gateways = [
        ...asArray(payload.payment_gateway_names).map((g) => str(g).toLowerCase()),
        str(payload.gateway).toLowerCase(),
      ];
      const tags = str(payload.tags).toLowerCase();
      if (
        gateways.some((g) => g.includes('cash_on_delivery') || g === 'cod' || g.includes('cash on delivery')) ||
        tags.includes('cash on delivery') ||
        tags.includes('cod')
      ) {
        return 'COD';
      }
      return gateways.find(Boolean) ? 'Prepaid' : str(payload.financial_status, 'Paid');
    }
    case 'tracking_link':
      return (
        str(ship?.tracking_url) ||
        str(asArray(ship?.tracking_urls)[0]) ||
        str(payload.order_status_url) ||
        '-'
      );
    case 'courier_name':
      return str(ship?.tracking_company || ship?.company || payload.tracking_company, '-');
    case 'checkout_link':
      return str(payload.abandoned_checkout_url || payload.checkout_url || payload.cart_url, '-');
    case 'order_status_link':
      return str(payload.order_status_url || payload.status_url, '-');
    case 'discount_code': {
      if (extras?.discountCode) return str(extras.discountCode);
      const codes = asArray(payload.discount_codes);
      const firstCode = codes[0] ? asRecord(codes[0])?.code : payload.discount_code;
      return str(firstCode, '-');
    }
    case 'store_name':
      return storeName || str(payload.shop_name, 'our store');
    default:
      // Allow literal strings in variableMap (e.g. a fixed discount code for reminder 2).
      return typeof field === 'string' && field.trim() ? field.trim() : '-';
  }
}

/**
 * Build ordered body variables and optional button URL param from a flow's variableMap.
 * Keys "1","2",… are body placeholders; "button_url" is the dynamic URL button suffix/full URL.
 */
export function buildTemplateVariables(
  variableMap: OrderFlowVariableMap | null | undefined,
  payload: ShopifyOrderLike,
  storeName: string,
  extras?: { discountCode?: string | null }
): { variables: string[]; buttonUrlParams?: string[] } {
  const map = variableMap ?? {};
  const bodyKeys = Object.keys(map)
    .filter((k) => /^\d+$/.test(k))
    .sort((a, b) => Number(a) - Number(b));
  const variables = bodyKeys.map((key) =>
    resolveOrderFlowField(map[key], payload, storeName, extras)
  );

  const buttonField = map.button_url ?? map.buttonUrl;
  const buttonUrlParams = buttonField
    ? [resolveOrderFlowField(buttonField, payload, storeName, extras)]
    : undefined;

  return { variables, buttonUrlParams };
}

/** Sample values for "Send a test" when no live order payload exists. */
export const ORDER_FLOW_SAMPLE_VALUES: Record<OrderFlowVariableField, string> = {
  customer_first_name: 'Priya',
  customer_full_name: 'Priya Sharma',
  order_number: '#1042',
  order_total: '₹1,499',
  number_of_items: '2',
  first_product_name: 'Glow Serum',
  payment_type: 'Prepaid',
  tracking_link: 'https://example.com/track/1042',
  courier_name: 'Delhivery',
  checkout_link: 'https://example.com/checkout',
  order_status_link: 'https://example.com/orders/1042',
  discount_code: 'COMEBACK10',
  store_name: 'Demo Store',
};

export function buildSampleTemplateVariables(
  variableMap: OrderFlowVariableMap | null | undefined,
  storeName: string
): { variables: string[]; buttonUrlParams?: string[] } {
  const map = variableMap ?? {};
  const bodyKeys = Object.keys(map)
    .filter((k) => /^\d+$/.test(k))
    .sort((a, b) => Number(a) - Number(b));
  const variables = bodyKeys.map((key) => {
    const field = map[key];
    if (!field) return '-';
    if (field === 'store_name') return storeName || ORDER_FLOW_SAMPLE_VALUES.store_name;
    if (Object.prototype.hasOwnProperty.call(ORDER_FLOW_SAMPLE_VALUES, field)) {
      return ORDER_FLOW_SAMPLE_VALUES[field as OrderFlowVariableField];
    }
    return String(field);
  });
  const buttonField = map.button_url ?? map.buttonUrl;
  const buttonUrlParams =
    buttonField && typeof buttonField === 'string'
      ? [
          buttonField === 'store_name'
            ? storeName || ORDER_FLOW_SAMPLE_VALUES.store_name
            : Object.prototype.hasOwnProperty.call(ORDER_FLOW_SAMPLE_VALUES, buttonField)
              ? ORDER_FLOW_SAMPLE_VALUES[buttonField as OrderFlowVariableField]
              : buttonField,
        ]
      : undefined;
  return { variables, buttonUrlParams };
}

export function extractPhoneFromPayload(payload: ShopifyOrderLike): string | null {
  const candidates = [
    payload.phone,
    asRecord(payload.customer)?.phone,
    asRecord(payload.billing_address)?.phone,
    asRecord(payload.shipping_address)?.phone,
    asRecord(payload.default_address)?.phone,
  ];
  for (const c of candidates) {
    const s = str(c).trim();
    if (s) return s;
  }
  return null;
}

export function extractEmailFromPayload(payload: ShopifyOrderLike): string | null {
  const email = str(payload.email || asRecord(payload.customer)?.email).trim().toLowerCase();
  return email || null;
}

export function extractCustomerName(payload: ShopifyOrderLike): string | null {
  const customer = customerRecord(payload);
  const first = str(customer?.first_name);
  const last = str(customer?.last_name);
  const full = `${first} ${last}`.trim();
  return full || str(customer?.name) || null;
}

export function cartTotalFromPayload(payload: ShopifyOrderLike): number | null {
  const raw = payload.total_price ?? asRecord(asRecord(payload.total_price_set)?.shop_money)?.amount;
  const n = typeof raw === 'number' ? raw : Number(str(raw, ''));
  return Number.isFinite(n) ? n : null;
}

export function isCodOrder(payload: ShopifyOrderLike): boolean {
  const gateways = [
    ...asArray(payload.payment_gateway_names).map((g) => str(g).toLowerCase()),
    str(payload.gateway).toLowerCase(),
  ];
  const tags = str(payload.tags).toLowerCase();
  if (
    gateways.some(
      (g) => g.includes('cash_on_delivery') || g === 'cod' || g.includes('cash on delivery')
    )
  ) {
    return true;
  }
  if (tags.includes('cash on delivery') || /(^|,\s*)cod(,|$)/i.test(tags)) return true;
  // Pending payment with no card gateway often means COD in Indian stores.
  const financial = str(payload.financial_status).toLowerCase();
  if (financial === 'pending' && gateways.some((g) => !g || g === 'manual')) {
    return tags.includes('cod') || gateways.includes('cash_on_delivery');
  }
  return false;
}

export function acceptsMarketing(payload: ShopifyOrderLike): boolean {
  if (payload.buyer_accepts_marketing === true) return true;
  if (payload.accepts_marketing === true) return true;
  const customer = asRecord(payload.customer);
  if (customer?.accepts_marketing === true) return true;
  if (customer?.email_marketing_consent) {
    const consent = asRecord(customer.email_marketing_consent);
    if (str(consent?.state).toLowerCase() === 'subscribed') return true;
  }
  if (customer?.sms_marketing_consent) {
    const consent = asRecord(customer.sms_marketing_consent);
    if (str(consent?.state).toLowerCase() === 'subscribed') return true;
  }
  return false;
}
