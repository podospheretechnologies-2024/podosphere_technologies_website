import type { LucideIcon } from 'lucide-react';
import {
  Bot,
  Briefcase,
  CalendarDays,
  ChartColumn,
  Contact,
  FileText,
  Image as ImageIcon,
  Inbox,
  LayoutDashboard,
  Megaphone,
  MessageCircle,
  Plug,
  Puzzle,
  TrendingUp,
} from 'lucide-react';

/**
 * Stable ids for portal routes under `/portal/[id]`. The ids never change (they are stored per
 * client and used in URLs); only the labels follow the admin app's names.
 * The order here is the default left-menu order and mirrors the admin rail.
 */
export const PORTAL_TAB_IDS = [
  'overview',
  'content',
  'agent',
  'analytics',
  'brand',
  'plugs',
  'channels',
  'whatsapp',
  'sales',
  'requests',
  'ads',
  'inbox',
  'leads',
  'reports',
] as const;

export type PortalTabId = (typeof PORTAL_TAB_IDS)[number];

/** What the client may do on a tab. `act` includes everything `view` allows. */
export const PORTAL_ACCESS_LEVELS = ['off', 'view', 'act'] as const;
export type PortalAccessLevel = (typeof PORTAL_ACCESS_LEVELS)[number];

export type PortalTabsConfig = {
  /** Explicit overrides. Missing key = use connection-aware default. */
  tabs?: Partial<Record<PortalTabId, PortalAccessLevel>>;
  /** Left-menu order set by the agency. Tabs not listed keep the default order after these. */
  order?: PortalTabId[];
  /** Ads tab: show spend amounts. Default true. */
  adSpendVisible?: boolean;
};

/** Connection flags used by `enabled()` — never trust URL/body for these. */
export type PortalClientFlags = {
  hasChannels: boolean;
  hasAds: boolean;
  hasShopify: boolean;
  hasLeadSources: boolean;
  hasWhatsApp: boolean;
  portalTabs: PortalTabsConfig | null;
};

export type PortalTabDefinition = {
  id: PortalTabId;
  label: string;
  href: string;
  icon: LucideIcon;
  /** Whether this tab shows for the client (override → connection default). */
  enabled: (client: PortalClientFlags) => boolean;
  /** What the client can do with "Can act". Missing = the tab is read-only, so only Hidden / View. */
  actions?: string;
  /** Agency UI hint when the default is connection-gated. */
  defaultHint?: string;
};

export const PORTAL_BASE_PATH = '/portal';

function defaultEnabled(id: PortalTabId, client: PortalClientFlags): boolean {
  switch (id) {
    case 'overview':
    case 'content':
    case 'analytics':
    case 'reports':
    case 'channels':
    case 'brand':
    case 'requests':
      return true;
    case 'ads':
      return client.hasAds;
    case 'sales':
      return client.hasShopify;
    case 'leads':
      return client.hasLeadSources;
    case 'whatsapp':
      return client.hasWhatsApp;
    case 'inbox':
      return client.hasChannels;
    // Optional / costly tabs — agency must switch on.
    case 'plugs':
    case 'agent':
      return false;
    default:
      return false;
  }
}

export const portalTabs: PortalTabDefinition[] = [
  {
    id: 'overview',
    label: 'Overview',
    href: `${PORTAL_BASE_PATH}/overview`,
    icon: LayoutDashboard,
    enabled: (client) => isPortalTabEnabled('overview', client),
  },
  {
    id: 'content',
    label: 'Calendar',
    href: `${PORTAL_BASE_PATH}/content`,
    icon: CalendarDays,
    enabled: (client) => isPortalTabEnabled('content', client),
    actions: 'Approve posts, ask for changes, leave notes, request a post',
  },
  {
    id: 'agent',
    label: 'Agent',
    href: `${PORTAL_BASE_PATH}/agent`,
    icon: Bot,
    enabled: (client) => isPortalTabEnabled('agent', client),
    actions: 'Chat with AI about this client only',
    defaultHint: 'Off by default — each chat uses AI credits',
  },
  {
    id: 'analytics',
    label: 'Analytics',
    href: `${PORTAL_BASE_PATH}/analytics`,
    icon: ChartColumn,
    enabled: (client) => isPortalTabEnabled('analytics', client),
  },
  {
    id: 'brand',
    label: 'Media',
    href: `${PORTAL_BASE_PATH}/brand`,
    icon: ImageIcon,
    enabled: (client) => isPortalTabEnabled('brand', client),
    actions: 'Edit the brand kit, upload photos',
  },
  {
    id: 'plugs',
    label: 'Plugs',
    href: `${PORTAL_BASE_PATH}/plugs`,
    icon: Plug,
    enabled: (client) => isPortalTabEnabled('plugs', client),
    defaultHint: 'Off by default — view auto-reply rules for own channels',
  },
  {
    id: 'channels',
    label: 'Integrations',
    href: `${PORTAL_BASE_PATH}/channels`,
    icon: Puzzle,
    enabled: (client) => isPortalTabEnabled('channels', client),
    actions: 'Connect and reconnect their own pages',
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    href: `${PORTAL_BASE_PATH}/whatsapp`,
    icon: MessageCircle,
    enabled: (client) => isPortalTabEnabled('whatsapp', client),
    defaultHint: 'On when a WhatsApp number is linked to this client',
  },
  {
    id: 'sales',
    label: 'Growth',
    href: `${PORTAL_BASE_PATH}/sales`,
    icon: TrendingUp,
    enabled: (client) => isPortalTabEnabled('sales', client),
    defaultHint: 'On when Shopify is connected',
  },
  {
    id: 'requests',
    label: 'Requests',
    href: `${PORTAL_BASE_PATH}/requests`,
    icon: Briefcase,
    enabled: (client) => isPortalTabEnabled('requests', client),
    actions: 'Send a new request to the agency',
  },
  {
    id: 'ads',
    label: 'Ads',
    href: `${PORTAL_BASE_PATH}/ads`,
    icon: Megaphone,
    enabled: (client) => isPortalTabEnabled('ads', client),
    defaultHint: 'On when Meta or Google Ads is linked',
  },
  {
    id: 'inbox',
    label: 'Inbox',
    href: `${PORTAL_BASE_PATH}/inbox`,
    icon: Inbox,
    enabled: (client) => isPortalTabEnabled('inbox', client),
    actions: 'Reply to comments and DMs on own channels',
    defaultHint: 'On when a social channel is linked',
  },
  {
    id: 'leads',
    label: 'Leads',
    href: `${PORTAL_BASE_PATH}/leads`,
    icon: Contact,
    enabled: (client) => isPortalTabEnabled('leads', client),
    actions: 'Change lead status',
    defaultHint: 'On when ads or WhatsApp is linked',
  },
  {
    id: 'reports',
    label: 'Reports',
    href: `${PORTAL_BASE_PATH}/reports`,
    icon: FileText,
    enabled: (client) => isPortalTabEnabled('reports', client),
  },
];

export function getPortalTab(id: PortalTabId): PortalTabDefinition | undefined {
  return portalTabs.find((tab) => tab.id === id);
}

/** Highest level a tab supports: read-only tabs stop at `view`. */
function maxLevel(id: PortalTabId): PortalAccessLevel {
  return getPortalTab(id)?.actions ? 'act' : 'view';
}

/** The client's level on one tab: agency override first, then the connection-aware default. */
export function portalTabLevel(id: PortalTabId, client: PortalClientFlags): PortalAccessLevel {
  const top = maxLevel(id);
  const override = client.portalTabs?.tabs?.[id];
  if (override === 'off') return 'off';
  if (override === 'view') return 'view';
  if (override === 'act') return top;
  // Default keeps what clients could already do before access levels existed.
  return defaultEnabled(id, client) ? top : 'off';
}

export function isPortalTabEnabled(id: PortalTabId, client: PortalClientFlags): boolean {
  return portalTabLevel(id, client) !== 'off';
}

export function canPortalAct(id: PortalTabId, client: PortalClientFlags): boolean {
  return portalTabLevel(id, client) === 'act';
}

export function isPortalAdSpendVisible(client: PortalClientFlags): boolean {
  const value = client.portalTabs?.adSpendVisible;
  return typeof value === 'boolean' ? value : true;
}

/** All tabs in the agency's order (listed ids first, the rest in default order). */
export function orderedPortalTabs(order?: PortalTabId[] | null): PortalTabDefinition[] {
  if (!order || order.length === 0) return portalTabs;
  const rank = new Map(order.map((id, index) => [id, index]));
  return [...portalTabs].sort((a, b) => {
    const left = rank.get(a.id) ?? order.length + portalTabs.indexOf(a);
    const right = rank.get(b.id) ?? order.length + portalTabs.indexOf(b);
    return left - right;
  });
}

export function enabledPortalTabs(client: PortalClientFlags): PortalTabDefinition[] {
  return orderedPortalTabs(client.portalTabs?.order).filter((tab) => tab.enabled(client));
}

function isTabId(value: unknown): value is PortalTabId {
  return typeof value === 'string' && (PORTAL_TAB_IDS as readonly string[]).includes(value);
}

/** Reads the stored Json. Old rows hold `true` / `false`; they mean "default level" / "off". */
export function parsePortalTabsConfig(value: unknown): PortalTabsConfig | null {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const tabs: Partial<Record<PortalTabId, PortalAccessLevel>> = {};
  if (raw.tabs && typeof raw.tabs === 'object' && !Array.isArray(raw.tabs)) {
    const map = raw.tabs as Record<string, unknown>;
    for (const id of PORTAL_TAB_IDS) {
      const entry = map[id];
      if (entry === true) tabs[id] = 'act';
      else if (entry === false) tabs[id] = 'off';
      else if (entry === 'off' || entry === 'view' || entry === 'act') tabs[id] = entry;
    }
  }
  const order = Array.isArray(raw.order)
    ? [...new Set(raw.order.filter(isTabId))]
    : [];
  const adSpendVisible = typeof raw.adSpendVisible === 'boolean' ? raw.adSpendVisible : undefined;
  if (Object.keys(tabs).length === 0 && order.length === 0 && adSpendVisible === undefined) {
    return null;
  }
  return {
    ...(Object.keys(tabs).length > 0 ? { tabs } : {}),
    ...(order.length > 0 ? { order } : {}),
    ...(adSpendVisible !== undefined ? { adSpendVisible } : {}),
  };
}
