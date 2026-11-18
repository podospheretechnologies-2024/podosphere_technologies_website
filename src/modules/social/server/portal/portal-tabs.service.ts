import 'server-only';
import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/shared/lib/prisma';
import { HttpError } from '@/shared/server/http-error';
import {
  enabledPortalTabs,
  isPortalAdSpendVisible,
  orderedPortalTabs,
  parsePortalTabsConfig,
  portalTabLevel,
  portalTabs,
  type PortalAccessLevel,
  type PortalClientFlags,
  type PortalTabDefinition,
  type PortalTabId,
  type PortalTabsConfig,
} from '../../config/portal-tabs';
import type { UpdatePortalTabsBody } from './portal-tabs.schema';

export type PortalTabsSettingsDto = {
  config: PortalTabsConfig;
  flags: Omit<PortalClientFlags, 'portalTabs'>;
  /** Effective visibility after overrides + connection defaults. */
  effective: Record<string, boolean>;
  /** Effective access level per tab: off / view / act. */
  levels: Record<string, PortalAccessLevel>;
  /** All tab ids in this client's left-menu order. */
  order: PortalTabId[];
  adSpendVisible: boolean;
};

const LEVEL_RANK: Record<PortalAccessLevel, number> = { off: 0, view: 1, act: 2 };

function toStoredJson(config: PortalTabsConfig): Prisma.InputJsonValue | typeof Prisma.DbNull {
  const hasTabs = config.tabs && Object.keys(config.tabs).length > 0;
  const hasOrder = config.order && config.order.length > 0;
  if (!hasTabs && !hasOrder && config.adSpendVisible === undefined) return Prisma.DbNull;
  return {
    ...(hasTabs ? { tabs: config.tabs } : {}),
    ...(hasOrder ? { order: config.order } : {}),
    ...(config.adSpendVisible !== undefined ? { adSpendVisible: config.adSpendVisible } : {}),
  } as Prisma.InputJsonValue;
}

async function loadFlags(
  organizationId: string,
  customerId: string,
  portalTabsRaw: unknown
): Promise<PortalClientFlags> {
  const [channels, metaAds, googleAds, shopify, whatsapp] = await Promise.all([
    prisma.socialIntegration.count({
      where: { organizationId, customerId, deletedAt: null },
    }),
    prisma.adAccount.count({
      where: { organizationId, customerId },
    }),
    prisma.socialGoogleAdsAccount.count({
      where: { organizationId, customerId },
    }),
    prisma.socialShopifyStore.count({
      where: { organizationId, customerId },
    }),
    prisma.socialWhatsAppConnection.count({
      where: { organizationId, customerId },
    }),
  ]);

  const hasAds = metaAds > 0 || googleAds > 0;
  return {
    hasChannels: channels > 0,
    hasAds,
    hasShopify: shopify > 0,
    hasLeadSources: hasAds || whatsapp > 0,
    hasWhatsApp: whatsapp > 0,
    portalTabs: parsePortalTabsConfig(portalTabsRaw),
  };
}

function toSettingsDto(flags: PortalClientFlags): PortalTabsSettingsDto {
  const effective: Record<string, boolean> = {};
  const levels: Record<string, PortalAccessLevel> = {};
  for (const tab of portalTabs) {
    effective[tab.id] = tab.enabled(flags);
    levels[tab.id] = portalTabLevel(tab.id, flags);
  }
  return {
    config: flags.portalTabs ?? {},
    flags: {
      hasChannels: flags.hasChannels,
      hasAds: flags.hasAds,
      hasShopify: flags.hasShopify,
      hasLeadSources: flags.hasLeadSources,
      hasWhatsApp: flags.hasWhatsApp,
    },
    effective,
    levels,
    order: orderedPortalTabs(flags.portalTabs?.order).map((tab) => tab.id),
    adSpendVisible: isPortalAdSpendVisible(flags),
  };
}

export const portalTabsService = {
  async getClientFlags(organizationId: string, customerId: string): Promise<PortalClientFlags> {
    const customer = await prisma.socialCustomer.findFirst({
      where: { id: customerId, organizationId, deletedAt: null },
      select: { portalTabs: true },
    });
    if (!customer) throw new HttpError(404, 'Client not found');
    return loadFlags(organizationId, customerId, customer.portalTabs);
  },

  async listEnabledTabs(organizationId: string, customerId: string): Promise<PortalTabDefinition[]> {
    const flags = await this.getClientFlags(organizationId, customerId);
    return enabledPortalTabs(flags);
  },

  async getSettings(organizationId: string, customerId: string): Promise<PortalTabsSettingsDto> {
    const flags = await this.getClientFlags(organizationId, customerId);
    return toSettingsDto(flags);
  },

  async updateSettings(
    organizationId: string,
    customerId: string,
    body: UpdatePortalTabsBody
  ): Promise<PortalTabsSettingsDto> {
    const customer = await prisma.socialCustomer.findFirst({
      where: { id: customerId, organizationId, deletedAt: null },
      select: { id: true, portalTabs: true },
    });
    if (!customer) throw new HttpError(404, 'Client not found');

    const current = parsePortalTabsConfig(customer.portalTabs) ?? {};
    const nextTabs = { ...(current.tabs ?? {}) };
    for (const [id, level] of Object.entries(body.tabs ?? {})) {
      if (level === null || level === undefined) delete nextTabs[id as PortalTabId];
      else nextTabs[id as PortalTabId] = level;
    }
    const next: PortalTabsConfig = {
      tabs: nextTabs,
      order: body.order ?? current.order,
      adSpendVisible:
        body.adSpendVisible !== undefined ? body.adSpendVisible : current.adSpendVisible,
    };

    await prisma.socialCustomer.update({
      where: { id: customerId },
      data: { portalTabs: toStoredJson(next) },
    });

    return this.getSettings(organizationId, customerId);
  },

  /**
   * Portal APIs: the session's client must have this tab at `need` or higher.
   * `view` = may read the tab, `act` = may change something on it.
   */
  async requireLevel(
    organizationId: string,
    customerId: string,
    tabId: PortalTabId,
    need: 'view' | 'act'
  ): Promise<void> {
    const flags = await this.getClientFlags(organizationId, customerId);
    const level = portalTabLevel(tabId, flags);
    if (LEVEL_RANK[level] >= LEVEL_RANK[need]) return;
    throw new HttpError(
      403,
      level === 'off'
        ? 'This section is not switched on for your account'
        : 'Your account can only view this section. Ask your agency to allow changes.'
    );
  },

  /** Copy one client's tab settings (levels, order, ad spend) onto other clients of the same org. */
  async copySettings(
    organizationId: string,
    sourceCustomerId: string,
    targetClientIds: string[]
  ): Promise<{ updated: number }> {
    const source = await prisma.socialCustomer.findFirst({
      where: { id: sourceCustomerId, organizationId, deletedAt: null },
      select: { portalTabs: true },
    });
    if (!source) throw new HttpError(404, 'Client not found');
    const targets = targetClientIds.filter((id) => id !== sourceCustomerId);
    if (targets.length === 0) return { updated: 0 };

    const result = await prisma.socialCustomer.updateMany({
      where: { id: { in: targets }, organizationId, deletedAt: null },
      data: { portalTabs: toStoredJson(parsePortalTabsConfig(source.portalTabs) ?? {}) },
    });
    return { updated: result.count };
  },
};
