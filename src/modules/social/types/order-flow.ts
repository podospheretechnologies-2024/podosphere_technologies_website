import type {
  OrderFlowDelayUnit,
  OrderFlowGroup,
  OrderFlowKey,
  OrderFlowVariableField,
} from '../config/order-flows';

/** Message lifecycle for Screen 3 (activity). */
export type OrderFlowMessageStatus =
  | 'waiting'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed'
  | 'cancelled'
  | 'skipped';

export interface OrderFlowOnlyIf {
  minCartValue?: number | null;
  paymentType?: 'any' | 'cod' | 'prepaid' | null;
}

export interface OrderFlowStopIf {
  onOrderPlaced?: boolean;
  onStopReply?: boolean;
}

/**
 * Template slot → field key (or null while editing).
 * e.g. `{ "1": "customer_first_name", "button_url": "checkout_link" }`
 * Literal strings are allowed for fixed discount codes on reminder 2.
 */
export type OrderFlowVariableMap = Record<
  string,
  OrderFlowVariableField | string | null
>;

/** List-row shape used by OrderFlowList. */
export interface OrderFlowListItem {
  flowKey: OrderFlowKey;
  group: OrderFlowGroup;
  label: string;
  when: string;
  enabled: boolean;
  templateName: string | null;
  templateLanguage: string | null;
  delayValue: number | null;
  delayUnit: OrderFlowDelayUnit | null;
  marketingHours: boolean;
  sent30d: number;
  delivered30d: number;
  recovered30d: number;
  revenue30d: number;
}

/**
 * Editor / desk row: same flow settings with `key` alias and nullable maps.
 * `deliveredPct` is 0–100 or null when nothing was sent.
 */
export interface OrderFlowRow {
  key: OrderFlowKey;
  group: OrderFlowGroup;
  label: string;
  when: string;
  enabled: boolean;
  templateName: string | null;
  templateLanguage: string | null;
  delayValue: number | null;
  delayUnit: OrderFlowDelayUnit | null;
  onlyIf: OrderFlowOnlyIf | null;
  variableMap: OrderFlowVariableMap | null;
  stopIf: OrderFlowStopIf;
  sent30d: number;
  deliveredPct: number | null;
  recovered30d: number | null;
  revenue30d: number | null;
}

export interface OrderFlowStoreStatus {
  connected: boolean;
  shopDomain: string | null;
  shopName: string | null;
  webhooksEnabled: boolean;
  lastWebhookAt: string | null;
  orderFlowsPaused: boolean;
  orderFlowsPausedReason: string | null;
  consecutiveSendFailures: number;
}

export interface OrderFlowListResponse {
  store: OrderFlowStoreStatus;
  /** Convenience aliases for older desk UI. */
  shopName: string | null;
  shopDomain: string | null;
  flows: OrderFlowListItem[];
  groups: {
    order_updates: OrderFlowRow[];
    recover_sales: OrderFlowRow[];
  };
}

export interface OrderFlowDetail {
  flowKey: OrderFlowKey;
  key: OrderFlowKey;
  group: OrderFlowGroup;
  label: string;
  when: string;
  enabled: boolean;
  templateName: string | null;
  templateLanguage: string | null;
  delayValue: number | null;
  delayUnit: OrderFlowDelayUnit | null;
  onlyIf: OrderFlowOnlyIf;
  variableMap: OrderFlowVariableMap;
  stopIf: OrderFlowStopIf;
  marketingHours: boolean;
  defaultDelay: { value: number; unit: OrderFlowDelayUnit } | null;
  sent30d?: number;
  deliveredPct?: number | null;
  recovered30d?: number | null;
  revenue30d?: number | null;
}

export interface OrderFlowActivityItem {
  id: string;
  /** Alias of createdAt / sentAt for the activity table. */
  time: string;
  createdAt: string;
  dueAt: string;
  sentAt: string | null;
  flowKey: OrderFlowKey;
  flowLabel: string;
  customerName: string | null;
  phone: string | null;
  orderLabel: string | null;
  cartTotal: number | null;
  currency: string | null;
  status: OrderFlowMessageStatus;
  statusReason: string | null;
  resultLabel: string | null;
  recoveredTotal: number | null;
}

export interface OrderFlowActivityResponse {
  rows: OrderFlowActivityItem[];
  items: OrderFlowActivityItem[];
  total: number;
}

export interface OrderFlowResultsByFlow {
  key: OrderFlowKey;
  flowKey: OrderFlowKey;
  label: string;
  sent: number;
  recovered: number;
  revenue: number;
}

export interface OrderFlowResultsResponse {
  from: string;
  to: string;
  messagesSent: number;
  cartsRecovered: number;
  revenueRecovered: number;
  /** Rough estimate; 0 until Meta conversation pricing is wired. */
  moneySpentEstimate: number;
  estimatedMessageCost: number | null;
  byFlow: OrderFlowResultsByFlow[];
}

export interface OrderFlowTestSendResult {
  messageId: string;
  to: string;
  /** Human-readable confirmation for the editor toast. */
  message?: string;
}
