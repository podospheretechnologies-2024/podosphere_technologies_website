import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  FileText,
  LayoutDashboard,
  Megaphone,
  MessageSquarePlus,
  Palette,
  Plug,
  ShoppingBag,
  Users,
  CalendarDays,
} from 'lucide-react';

/** Stable ids for portal routes under `/portal/[id]`. */
export const PORTAL_TAB_IDS = [
  'overview',
  'content',
  'analytics',
  'ads',
  'leads',
  'sales',
  'reports',
  'channels',
  'brand',
  'requests',
] as const;

export type PortalTabId = (typeof PORTAL_TAB_IDS)[number];

export type PortalTabsConfig = {
  /** Explicit on/off overrides. Missing key = use connection-aware default. */
  tabs?: Partial<Record<PortalTabId, boolean>>;
  /** Ads tab: show spend amounts. Default true. */
  adSpendVisible?: boolean;
};

/** Connection flags used by `enabled()` — never trust URL/body for these. */
export type PortalClientFlags = {
  hasChannels: boolean;
  hasAds: boolean;
  hasShopify: boolean;
  hasLeadSources: boolean;
  portalTabs: PortalTabsConfig | null;
};

export type PortalTabDefinition = {
  id: PortalTabId;
  label: string;
  href: string;
  icon: LucideIcon;
  /** Whether this tab shows for the client (override → connection default). */
  enabled: (client: PortalClientFlags) => boolean;
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
    default:
      return false;
  }
}

export function isPortalTabEnabled(id: PortalTabId, client: PortalClientFlags): boolean {
  const override = client.portalTabs?.tabs?.[id];
  if (typeof override === 'boolean') return override;
  return defaultEnabled(id, client);
}

export function isPortalAdSpendVisible(client: PortalClientFlags): boolean {
  const value = client.portalTabs?.adSpendVisible;
  return typeof value === 'boolean' ? value : true;
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
    label: 'Content',
    href: `${PORTAL_BASE_PATH}/content`,
    icon: CalendarDays,
    enabled: (client) => isPortalTabEnabled('content', client),
  },
  {
    id: 'analytics',
    label: 'Analytics',
    href: `${PORTAL_BASE_PATH}/analytics`,
    icon: BarChart3,
    enabled: (client) => isPortalTabEnabled('analytics', client),
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
    id: 'leads',
    label: 'Leads',
    href: `${PORTAL_BASE_PATH}/leads`,
    icon: Users,
    enabled: (client) => isPortalTabEnabled('leads', client),
    defaultHint: 'On when ads or WhatsApp is linked',
  },
  {
    id: 'sales',
    label: 'Sales',
    href: `${PORTAL_BASE_PATH}/sales`,
    icon: ShoppingBag,
    enabled: (client) => isPortalTabEnabled('sales', client),
    defaultHint: 'On when Shopify is connected',
  },
  {
    id: 'reports',
    label: 'Reports',
    href: `${PORTAL_BASE_PATH}/reports`,
    icon: FileText,
    enabled: (client) => isPortalTabEnabled('reports', client),
  },
  {
    id: 'channels',
    label: 'Channels',
    href: `${PORTAL_BASE_PATH}/channels`,
    icon: Plug,
    enabled: (client) => isPortalTabEnabled('channels', client),
  },
  {
    id: 'brand',
    label: 'Brand kit',
    href: `${PORTAL_BASE_PATH}/brand`,
    icon: Palette,
    enabled: (client) => isPortalTabEnabled('brand', client),
  },
  {
    id: 'requests',
    label: 'Requests',
    href: `${PORTAL_BASE_PATH}/requests`,
    icon: MessageSquarePlus,
    enabled: (client) => isPortalTabEnabled('requests', client),
  },
];

export function getPortalTab(id: PortalTabId): PortalTabDefinition | undefined {
  return portalTabs.find((tab) => tab.id === id);
}

export function enabledPortalTabs(client: PortalClientFlags): PortalTabDefinition[] {
  return portalTabs.filter((tab) => tab.enabled(client));
}

export function parsePortalTabsConfig(value: unknown): PortalTabsConfig | null {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const tabs: Partial<Record<PortalTabId, boolean>> = {};
  if (raw.tabs && typeof raw.tabs === 'object' && !Array.isArray(raw.tabs)) {
    const map = raw.tabs as Record<string, unknown>;
    for (const id of PORTAL_TAB_IDS) {
      if (typeof map[id] === 'boolean') tabs[id] = map[id];
    }
  }
  const adSpendVisible = typeof raw.adSpendVisible === 'boolean' ? raw.adSpendVisible : undefined;
  if (Object.keys(tabs).length === 0 && adSpendVisible === undefined) return null;
  return {
    ...(Object.keys(tabs).length > 0 ? { tabs } : {}),
    ...(adSpendVisible !== undefined ? { adSpendVisible } : {}),
  };
}
