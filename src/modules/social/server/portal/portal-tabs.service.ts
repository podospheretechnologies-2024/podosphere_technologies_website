import 'server-only';
import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/shared/lib/prisma';
import { HttpError } from '@/shared/server/http-error';
import {
  enabledPortalTabs,
  isPortalAdSpendVisible,
  parsePortalTabsConfig,
  portalTabs,
  type PortalClientFlags,
  type PortalTabDefinition,
  type PortalTabsConfig,
} from '../../config/portal-tabs';
import type { UpdatePortalTabsBody } from './portal-tabs.schema';

export type PortalTabsSettingsDto = {
  config: PortalTabsConfig;
  flags: Omit<PortalClientFlags, 'portalTabs'>;
  /** Effective visibility after overrides + connection defaults. */
  effective: Record<string, boolean>;
  adSpendVisible: boolean;
};

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
    portalTabs: parsePortalTabsConfig(portalTabsRaw),
  };
}

function toSettingsDto(flags: PortalClientFlags): PortalTabsSettingsDto {
  const effective: Record<string, boolean> = {};
  for (const tab of portalTabs) {
    effective[tab.id] = tab.enabled(flags);
  }
  return {
    config: flags.portalTabs ?? {},
    flags: {
      hasChannels: flags.hasChannels,
      hasAds: flags.hasAds,
      hasShopify: flags.hasShopify,
      hasLeadSources: flags.hasLeadSources,
    },
    effective,
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
    const nextTabs = { ...(current.tabs ?? {}), ...(body.tabs ?? {}) };
    const next: PortalTabsConfig = {};
    if (Object.keys(nextTabs).length > 0) next.tabs = nextTabs;
    const adSpendVisible =
      body.adSpendVisible !== undefined ? body.adSpendVisible : current.adSpendVisible;
    if (typeof adSpendVisible === 'boolean') next.adSpendVisible = adSpendVisible;

    await prisma.socialCustomer.update({
      where: { id: customerId },
      data: {
        portalTabs:
          next.tabs || next.adSpendVisible !== undefined
            ? (next as Prisma.InputJsonValue)
            : Prisma.DbNull,
      },
    });

    return this.getSettings(organizationId, customerId);
  },
};
