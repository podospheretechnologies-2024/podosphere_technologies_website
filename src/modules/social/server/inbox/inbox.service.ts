import 'server-only';
import { prisma } from '@/shared/lib/prisma';

async function organizationForPage(pageId: string): Promise<string | null> {
  const integration = await prisma.socialIntegration.findFirst({
    where: { internalId: pageId, deletedAt: null },
    select: { organizationId: true },
  });
  if (integration) return integration.organizationId;
  const fallback = await prisma.organization.findFirst({
    where: { deletedAt: null },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  return fallback?.id ?? null;
}

export const inboxService = {
  async listThreads(organizationId: string) {
    const rows = await prisma.socialInboxThread.findMany({
      where: { organizationId },
      orderBy: { lastMessageAt: 'desc' },
      take: 100,
    });
    return rows.map((row) => ({
      id: row.id,
      platform: row.platform,
      contactName: row.contactName,
      lastPreview: row.lastPreview,
      lastMessageAt: row.lastMessageAt.toISOString(),
    }));
  },

  async getThread(organizationId: string, id: string) {
    const thread = await prisma.socialInboxThread.findFirst({
      where: { id, organizationId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!thread) return null;
    return {
      id: thread.id,
      platform: thread.platform,
      contactName: thread.contactName,
      messages: thread.messages.map((message) => ({
        id: message.id,
        direction: message.direction,
        body: message.body,
        createdAt: message.createdAt.toISOString(),
      })),
    };
  },

  async listLeads(organizationId: string) {
    const rows = await prisma.socialLead.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return rows.map((row) => ({
      id: row.id,
      source: row.source,
      name: row.name,
      email: row.email,
      phone: row.phone,
      createdAt: row.createdAt.toISOString(),
    }));
  },

  async ingestPageWebhook(payload: {
    object?: string;
    entry?: {
      id: string;
      messaging?: { sender?: { id?: string }; message?: { mid?: string; text?: string } }[];
      changes?: { field: string; value: Record<string, unknown> }[];
    }[];
  }): Promise<{ stored: number }> {
    if (payload.object !== 'page' && payload.object !== 'instagram') {
      return { stored: 0 };
    }
    let stored = 0;
    for (const entry of payload.entry ?? []) {
      const organizationId = await organizationForPage(entry.id);
      if (!organizationId) continue;
      const platform = payload.object === 'instagram' ? 'instagram' : 'facebook';

      for (const event of entry.messaging ?? []) {
        const text = event.message?.text?.trim();
        const sender = event.sender?.id;
        if (!text || !sender) continue;
        const thread = await prisma.socialInboxThread.upsert({
          where: {
            organizationId_platform_externalId: {
              organizationId,
              platform,
              externalId: sender,
            },
          },
          create: {
            organizationId,
            platform,
            externalId: sender,
            contactName: sender,
            lastPreview: text.slice(0, 500),
            lastMessageAt: new Date(),
          },
          update: { lastPreview: text.slice(0, 500), lastMessageAt: new Date() },
        });
        await prisma.socialInboxMessage.create({
          data: {
            threadId: thread.id,
            direction: 'inbound',
            body: text,
            externalId: event.message?.mid ?? null,
          },
        });
        stored += 1;
      }

      for (const change of entry.changes ?? []) {
        if (change.field === 'leadgen') {
          const value = change.value;
          const leadgenId = String(value.leadgen_id ?? '');
          if (!leadgenId) continue;
          await prisma.socialLead.upsert({
            where: {
              organizationId_source_externalId: {
                organizationId,
                source: platform,
                externalId: leadgenId,
              },
            },
            create: {
              organizationId,
              source: platform,
              externalId: leadgenId,
              payload: JSON.parse(JSON.stringify(value)) as object,
            },
            update: { payload: JSON.parse(JSON.stringify(value)) as object },
          });
          stored += 1;
        }
        if (change.field === 'feed' || change.field === 'comments') {
          const value = change.value;
          const message = String(value.message ?? value.text ?? '').trim();
          const from = (value.from as { id?: string; name?: string } | undefined) ?? {};
          const commentId = String(value.comment_id ?? value.id ?? '');
          if (!message || !commentId) continue;
          const externalId = from.id || commentId;
          const thread = await prisma.socialInboxThread.upsert({
            where: {
              organizationId_platform_externalId: {
                organizationId,
                platform,
                externalId,
              },
            },
            create: {
              organizationId,
              platform,
              externalId,
              contactName: from.name ?? externalId,
              lastPreview: message.slice(0, 500),
              lastMessageAt: new Date(),
            },
            update: {
              contactName: from.name ?? undefined,
              lastPreview: message.slice(0, 500),
              lastMessageAt: new Date(),
            },
          });
          await prisma.socialInboxMessage.create({
            data: { threadId: thread.id, direction: 'inbound', body: message, externalId: commentId },
          });
          stored += 1;
        }
      }
    }
    return { stored };
  },
};
