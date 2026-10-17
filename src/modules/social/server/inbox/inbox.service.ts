import 'server-only';
import { prisma } from '@/shared/lib/prisma';
import { scopeWhere, type ClientScope } from '@/shared/server/client-scope';
import { HttpError } from '@/shared/server/http-error';
import { DEFAULT_INBOX_SLA_HOURS, LEAD_STAGES, type LeadStage } from './inbox.schema';

function slaDueFromNow(hours = DEFAULT_INBOX_SLA_HOURS): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

async function ensureSlaIfUnset(threadId: string, slaDueAt: Date | null) {
  if (slaDueAt) return;
  await prisma.socialInboxThread.update({
    where: { id: threadId },
    data: { slaDueAt: slaDueFromNow() },
  });
}

// Webhook -> Page/IG id -> channel -> organization + client (PODO_SOCIAL_CLIENT_PLAN.md 4.1, rule 3).
async function ownerForPage(pageId: string): Promise<{ organizationId: string; customerId: string | null } | null> {
  const integration = await prisma.socialIntegration.findFirst({
    where: { internalId: pageId, deletedAt: null },
    select: { organizationId: true, customerId: true },
  });
  if (integration) return { organizationId: integration.organizationId, customerId: integration.customerId };
  const fallback = await prisma.organization.findFirst({
    where: { deletedAt: null },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  return fallback ? { organizationId: fallback.id, customerId: null } : null;
}

function mapThread(row: {
  id: string;
  platform: string;
  contactName: string | null;
  lastPreview: string | null;
  lastMessageAt: Date;
  assigneeId: string | null;
  slaDueAt: Date | null;
  firstResponseAt: Date | null;
  slaBreachedAt?: Date | null;
  assignee?: { id: string; name: string } | null;
}) {
  const slaDueAt = row.slaDueAt?.toISOString() ?? null;
  const firstResponseAt = row.firstResponseAt?.toISOString() ?? null;
  // Same criteria as alerts.slaSweep (minus one-shot slaBreachedAt stamp).
  const overdue = Boolean(row.slaDueAt && !row.firstResponseAt && row.slaDueAt.getTime() < Date.now());
  return {
    id: row.id,
    platform: row.platform,
    contactName: row.contactName,
    lastPreview: row.lastPreview,
    lastMessageAt: row.lastMessageAt.toISOString(),
    assigneeId: row.assigneeId,
    assigneeName: row.assignee?.name ?? null,
    slaDueAt,
    firstResponseAt,
    slaBreachedAt: row.slaBreachedAt?.toISOString() ?? null,
    overdue,
  };
}

export const inboxService = {
  async listMembers(scope: ClientScope) {
    return prisma.user.findMany({
      where: { organizationId: scope.organizationId, deletedAt: null },
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' },
    });
  },

  async listThreads(scope: ClientScope, options?: { assigneeId?: string | null }) {
    const rows = await prisma.socialInboxThread.findMany({
      where: {
        ...scopeWhere(scope),
        ...(options?.assigneeId !== undefined ? { assigneeId: options.assigneeId } : {}),
      },
      orderBy: { lastMessageAt: 'desc' },
      take: 100,
      include: { assignee: { select: { id: true, name: true } } },
    });
    return rows.map(mapThread);
  },

  async getThread(scope: ClientScope, id: string) {
    const thread = await prisma.socialInboxThread.findFirst({
      where: { id, ...scopeWhere(scope) },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        assignee: { select: { id: true, name: true } },
      },
    });
    if (!thread) return null;
    return {
      ...mapThread(thread),
      messages: thread.messages.map((message) => ({
        id: message.id,
        direction: message.direction,
        body: message.body,
        createdAt: message.createdAt.toISOString(),
      })),
    };
  },

  async assignThread(
    scope: ClientScope,
    id: string,
    input: { assigneeId?: string | null; slaDueAt?: string | null }
  ) {
    const existing = await prisma.socialInboxThread.findFirst({
      where: { id, ...scopeWhere(scope) },
      select: { id: true },
    });
    if (!existing) throw new HttpError(404, 'Thread not found');

    if (input.assigneeId) {
      const member = await prisma.user.findFirst({
        where: { id: input.assigneeId, organizationId: scope.organizationId, deletedAt: null },
        select: { id: true },
      });
      if (!member) throw new HttpError(400, 'Assignee is not a member of this organization');
    }

    const updated = await prisma.socialInboxThread.update({
      where: { id },
      data: {
        ...(input.assigneeId !== undefined ? { assigneeId: input.assigneeId } : {}),
        ...(input.slaDueAt !== undefined
          ? { slaDueAt: input.slaDueAt ? new Date(input.slaDueAt) : null }
          : {}),
      },
      include: { assignee: { select: { id: true, name: true } } },
    });
    return mapThread(updated);
  },

  async listLeads(scope: ClientScope, options?: { stage?: string }) {
    const rows = await prisma.socialLead.findMany({
      where: {
        ...scopeWhere(scope),
        ...(options?.stage ? { stage: options.stage } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return rows.map((row) => ({
      id: row.id,
      source: row.source,
      name: row.name,
      email: row.email,
      phone: row.phone,
      stage: row.stage,
      createdAt: row.createdAt.toISOString(),
    }));
  },

  async updateLeadStage(scope: ClientScope, id: string, stage: LeadStage) {
    if (!(LEAD_STAGES as readonly string[]).includes(stage)) {
      throw new HttpError(400, 'Invalid lead stage');
    }
    const existing = await prisma.socialLead.findFirst({
      where: { id, ...scopeWhere(scope) },
      select: { id: true },
    });
    if (!existing) throw new HttpError(404, 'Lead not found');

    const updated = await prisma.socialLead.update({
      where: { id },
      data: { stage },
    });

    // Stub: push stage change to PodoCRM when lead sync is wired.
    // await podoCrmLeadSync.pushStage({ organizationId: scope.organizationId, leadId: id, stage });

    return {
      id: updated.id,
      source: updated.source,
      name: updated.name,
      email: updated.email,
      phone: updated.phone,
      stage: updated.stage,
      createdAt: updated.createdAt.toISOString(),
    };
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
      const owner = await ownerForPage(entry.id);
      if (!owner) continue;
      const { organizationId, customerId } = owner;
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
            customerId,
            platform,
            externalId: sender,
            contactName: sender,
            lastPreview: text.slice(0, 500),
            lastMessageAt: new Date(),
            slaDueAt: slaDueFromNow(),
          },
          update: { lastPreview: text.slice(0, 500), lastMessageAt: new Date() },
        });
        await ensureSlaIfUnset(thread.id, thread.slaDueAt);
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
              customerId,
              source: platform,
              externalId: leadgenId,
              stage: 'new',
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
              customerId,
              platform,
              externalId,
              contactName: from.name ?? externalId,
              lastPreview: message.slice(0, 500),
              lastMessageAt: new Date(),
              slaDueAt: slaDueFromNow(),
            },
            update: {
              contactName: from.name ?? undefined,
              lastPreview: message.slice(0, 500),
              lastMessageAt: new Date(),
            },
          });
          await ensureSlaIfUnset(thread.id, thread.slaDueAt);
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
