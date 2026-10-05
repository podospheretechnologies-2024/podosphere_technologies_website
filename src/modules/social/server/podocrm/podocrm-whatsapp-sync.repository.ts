import 'server-only';
import { prisma } from '@/shared/lib/prisma';

export const podoCrmWhatsAppSyncRepository = {
  findByOrganization(organizationId: string) {
    return prisma.socialPodoCrmWhatsAppSync.findUnique({ where: { organizationId } });
  },

  findByPhoneNumberId(phoneNumberId: string) {
    return prisma.socialPodoCrmWhatsAppSync.findMany({ where: { phoneNumberId } });
  },

  upsert(input: {
    organizationId: string;
    syncSecret: string;
    phoneNumberId: string;
    podocrmCompanyId: string;
    podocrmBaseUrl: string;
  }) {
    return prisma.socialPodoCrmWhatsAppSync.upsert({
      where: { organizationId: input.organizationId },
      create: {
        organizationId: input.organizationId,
        syncSecret: input.syncSecret,
        phoneNumberId: input.phoneNumberId,
        podocrmCompanyId: input.podocrmCompanyId,
        podocrmBaseUrl: input.podocrmBaseUrl,
        linkedAt: new Date(),
      },
      update: {
        syncSecret: input.syncSecret,
        phoneNumberId: input.phoneNumberId,
        podocrmCompanyId: input.podocrmCompanyId,
        podocrmBaseUrl: input.podocrmBaseUrl,
        linkedAt: new Date(),
        lastPingAt: null,
      },
    });
  },

  markPinged(organizationId: string) {
    return prisma.socialPodoCrmWhatsAppSync.update({
      where: { organizationId },
      data: { lastPingAt: new Date() },
    });
  },

  delete(organizationId: string) {
    return prisma.socialPodoCrmWhatsAppSync.deleteMany({ where: { organizationId } });
  },
};
