/** Fixed Interakt-style WhatsApp order flows (PODO_WHATSAPP_ORDER_FLOWS_PLAN). */

export const ORDER_FLOW_KEYS = [
  'order_confirmed_prepaid',
  'order_confirmed_cod',
  'payment_received',
  'order_shipped',
  'order_cancelled',
  'refund_done',
  'abandoned_checkout_1',
  'abandoned_checkout_2',
  'review_request',
] as const;

export type OrderFlowKey = (typeof ORDER_FLOW_KEYS)[number];

export type OrderFlowGroup = 'order_updates' | 'recover_sales';

export type OrderFlowDelayUnit = 'minutes' | 'hours' | 'days';

export type OrderFlowVariableField =
  | 'customer_first_name'
  | 'customer_full_name'
  | 'order_number'
  | 'order_total'
  | 'number_of_items'
  | 'first_product_name'
  | 'payment_type'
  | 'tracking_link'
  | 'courier_name'
  | 'checkout_link'
  | 'order_status_link'
  | 'discount_code'
  | 'store_name';

export const ORDER_FLOW_VARIABLE_FIELDS: { key: OrderFlowVariableField; label: string }[] = [
  { key: 'customer_first_name', label: 'Customer first name' },
  { key: 'customer_full_name', label: 'Customer full name' },
  { key: 'order_number', label: 'Order number' },
  { key: 'order_total', label: 'Order / cart total' },
  { key: 'number_of_items', label: 'Number of items' },
  { key: 'first_product_name', label: 'First product name' },
  { key: 'payment_type', label: 'Payment type' },
  { key: 'tracking_link', label: 'Tracking link' },
  { key: 'courier_name', label: 'Courier name' },
  { key: 'checkout_link', label: 'Checkout link' },
  { key: 'order_status_link', label: 'Order status link' },
  { key: 'discount_code', label: 'Discount code' },
  { key: 'store_name', label: 'Store name' },
];

export interface OrderFlowDefinition {
  key: OrderFlowKey;
  group: OrderFlowGroup;
  label: string;
  when: string;
  /** Default delay; null = send immediately when the event arrives. */
  defaultDelay: { value: number; unit: OrderFlowDelayUnit } | null;
  /** Marketing messages only between 10:00–21:00 IST. */
  marketingHours: boolean;
  shopifyTopics: string[];
}

export const ORDER_FLOW_DEFINITIONS: OrderFlowDefinition[] = [
  {
    key: 'order_confirmed_prepaid',
    group: 'order_updates',
    label: 'Order confirmed (prepaid)',
    when: 'A prepaid order is placed',
    defaultDelay: null,
    marketingHours: false,
    shopifyTopics: ['orders/create', 'orders/paid'],
  },
  {
    key: 'order_confirmed_cod',
    group: 'order_updates',
    label: 'Order confirmed (COD)',
    when: 'A cash-on-delivery order is placed',
    defaultDelay: null,
    marketingHours: false,
    shopifyTopics: ['orders/create'],
  },
  {
    key: 'payment_received',
    group: 'order_updates',
    label: 'Payment received',
    when: 'Payment is captured for an order',
    defaultDelay: null,
    marketingHours: false,
    shopifyTopics: ['orders/paid'],
  },
  {
    key: 'order_shipped',
    group: 'order_updates',
    label: 'Order shipped',
    when: 'A fulfillment is created',
    defaultDelay: null,
    marketingHours: false,
    shopifyTopics: ['fulfillments/create'],
  },
  {
    key: 'order_cancelled',
    group: 'order_updates',
    label: 'Order cancelled',
    when: 'An order is cancelled',
    defaultDelay: null,
    marketingHours: false,
    shopifyTopics: ['orders/cancelled'],
  },
  {
    key: 'refund_done',
    group: 'order_updates',
    label: 'Refund done',
    when: 'A refund is created',
    defaultDelay: null,
    marketingHours: false,
    shopifyTopics: ['refunds/create'],
  },
  {
    key: 'abandoned_checkout_1',
    group: 'recover_sales',
    label: 'Abandoned checkout 1',
    when: 'A customer leaves the checkout',
    defaultDelay: { value: 45, unit: 'minutes' },
    marketingHours: true,
    shopifyTopics: ['checkouts/create', 'checkouts/update'],
  },
  {
    key: 'abandoned_checkout_2',
    group: 'recover_sales',
    label: 'Abandoned checkout 2',
    when: 'Still no order after the first reminder',
    defaultDelay: { value: 24, unit: 'hours' },
    marketingHours: true,
    shopifyTopics: ['checkouts/create', 'checkouts/update'],
  },
  {
    key: 'review_request',
    group: 'recover_sales',
    label: 'Review request',
    when: 'Days after the order is delivered',
    defaultDelay: { value: 5, unit: 'days' },
    marketingHours: true,
    shopifyTopics: ['orders/fulfilled'],
  },
];

export const ORDER_FLOW_BY_KEY = Object.fromEntries(
  ORDER_FLOW_DEFINITIONS.map((d) => [d.key, d])
) as Record<OrderFlowKey, OrderFlowDefinition>;

/** Topics to register when turning on live Shopify events. */
export const SHOPIFY_ORDER_FLOW_TOPICS = [
  'orders/create',
  'orders/paid',
  'orders/cancelled',
  'orders/fulfilled',
  'fulfillments/create',
  'refunds/create',
  'checkouts/create',
  'checkouts/update',
] as const;

export const ORDER_FLOW_FAIL_PAUSE_THRESHOLD = 20;
export const ORDER_FLOW_RECOVERY_WINDOW_DAYS = 7;
export const ORDER_FLOW_MARKETING_START_HOUR_IST = 10;
export const ORDER_FLOW_MARKETING_END_HOUR_IST = 21;

/** Suggested Meta template drafts for Submit from the WhatsApp page. */
export const ORDER_FLOW_STARTER_TEMPLATES: Record<
  OrderFlowKey,
  { name: string; category: 'UTILITY' | 'MARKETING'; body: string; buttonText?: string }
> = {
  order_confirmed_prepaid: {
    name: 'order_confirmed_v1',
    category: 'UTILITY',
    body: 'Hi {{1}}, thanks for your order {{2}} of {{3}}. We are getting it ready.',
  },
  order_confirmed_cod: {
    name: 'cod_confirm_v1',
    category: 'UTILITY',
    body: 'Hi {{1}}, your COD order {{2}} for {{3}} is confirmed. Reply YES to keep it, or NO to cancel.',
  },
  payment_received: {
    name: 'payment_received_v1',
    category: 'UTILITY',
    body: 'Hi {{1}}, we received payment for order {{2}} ({{3}}). Thank you!',
  },
  order_shipped: {
    name: 'order_shipped_v2',
    category: 'UTILITY',
    body: 'Hi {{1}}, order {{2}} has shipped via {{3}}. Track it here: {{4}}',
    buttonText: 'Track order',
  },
  order_cancelled: {
    name: 'order_cancelled_v1',
    category: 'UTILITY',
    body: 'Hi {{1}}, order {{2}} has been cancelled. If you did not request this, reply to this chat.',
  },
  refund_done: {
    name: 'refund_done_v1',
    category: 'UTILITY',
    body: 'Hi {{1}}, your refund for order {{2}} ({{3}}) has been processed.',
  },
  abandoned_checkout_1: {
    name: 'cart_reminder_v1',
    category: 'MARKETING',
    body: 'Hi {{1}}, you left {{2}} items in your cart worth {{3}}. Complete your order before they sell out.',
    buttonText: 'Complete order',
  },
  abandoned_checkout_2: {
    name: 'cart_reminder_v2',
    category: 'MARKETING',
    body: 'Hi {{1}}, your cart of {{2}} is still waiting. Use code {{3}} if you need a nudge.',
    buttonText: 'Complete order',
  },
  review_request: {
    name: 'review_request_v1',
    category: 'MARKETING',
    body: 'Hi {{1}}, how was {{2}}? We would love a quick review.',
    buttonText: 'Leave a review',
  },
};
