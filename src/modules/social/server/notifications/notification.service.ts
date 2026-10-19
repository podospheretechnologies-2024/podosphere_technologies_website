import 'server-only';
import { prisma } from '@/shared/lib/prisma';
import { getServerEnv } from '@/shared/lib/env';
import { sendNotificationEmail } from '@/shared/server/mailer';
import {
  NOTIFICATION_TYPE_LABELS,
  type SocialNotificationType,
} from '../../config/notifications';

const LIST_LIMIT = 30;
const DEDUPE_HOURS = 24;

export type CreateNotificationInput = {
  organizationId: string;
  type: SocialNotificationType;
  content: string;
  link?: string | null;
  /** When true (default), email OWNER/ADMIN if RESEND_API_KEY is set. Soft-fails. */
  email?: boolean;
  /** Skip create when the same type was already written recently (default false). */
  dedupeHours?: number | false;
};

export type NotificationDto = {
  id: string;
  type: SocialNotificationType | string;
  content: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

function absoluteLink(link: string | null | undefined): string | null {
  if (!link) return null;
  if (link.startsWith('http://') || link.startsWith('https://')) return link;
  const base = getServerEnv().APP_URL.replace(/\/$/, '');
  return `${base}${link.startsWith('/') ? link : `/${link}`}`;
}

async function orgAdminEmails(organizationId: string): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: {
      organizationId,
      deletedAt: null,
      role: { in: ['OWNER', 'ADMIN'] },
    },
    select: { email: true },
  });
  return users.map((u) => u.email).filter(Boolean);
}

async function recentlyNotified(
  organizationId: string,
  type: SocialNotificationType,
  hours: number,
  contentPrefix?: string
): Promise<boolean> {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  const existing = await prisma.socialNotification.findFirst({
    where: {
      organizationId,
      type,
      deletedAt: null,
      createdAt: { gte: since },
      ...(contentPrefix ? { content: { startsWith: contentPrefix } } : {}),
    },
    select: { id: true },
  });
  return Boolean(existing);
}

function toDto(row: {
  id: string;
  type: string;
  content: string;
  link: string | null;
  readAt: Date | null;
  createdAt: Date;
}): NotificationDto {
  return {
    id: row.id,
    type: row.type,
    content: row.content,
    link: row.link,
    readAt: row.readAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export const notificationService = {
  /**
   * Persist a SocialNotification and optionally email org owners/admins.
   * Email never throws; DB write errors are logged and rethrown by callers that care.
   */
  async create(input: CreateNotificationInput): Promise<NotificationDto | null> {
    const dedupeHours = input.dedupeHours === false ? false : (input.dedupeHours ?? false);
    if (dedupeHours !== false) {
      const exists = await recentlyNotified(input.organizationId, input.type, dedupeHours);
      if (exists) return null;
    }

    const row = await prisma.socialNotification.create({
      data: {
        organizationId: input.organizationId,
        type: input.type,
        content: input.content,
        link: input.link ?? null,
      },
    });

    if (input.email !== false) {
      try {
        const to = await orgAdminEmails(input.organizationId);
        if (to.length > 0) {
          const label = NOTIFICATION_TYPE_LABELS[input.type] ?? input.type;
          await sendNotificationEmail({
            to,
            subject: `[Podo Social] ${label}`,
            title: label,
            body: input.content,
            actionUrl: absoluteLink(input.link),
          });
        }
      } catch (err) {
        console.error('[notifications] email soft-fail', err);
      }
    }

    return toDto(row);
  },

  async list(
    organizationId: string,
    options?: { unreadOnly?: boolean; limit?: number }
  ): Promise<{ items: NotificationDto[]; unreadCount: number }> {
    const limit = Math.min(options?.limit ?? LIST_LIMIT, 50);
    const where = {
      organizationId,
      deletedAt: null,
      ...(options?.unreadOnly ? { readAt: null } : {}),
    };

    const [rows, unreadCount] = await Promise.all([
      prisma.socialNotification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      prisma.socialNotification.count({
        where: { organizationId, deletedAt: null, readAt: null },
      }),
    ]);

    return { items: rows.map(toDto), unreadCount };
  },

  async markRead(organizationId: string, id: string): Promise<NotificationDto | null> {
    const existing = await prisma.socialNotification.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!existing) return null;
    if (existing.readAt) return toDto(existing);

    const updated = await prisma.socialNotification.update({
      where: { id },
      data: { readAt: new Date() },
    });
    return toDto(updated);
  },

  async markAllRead(organizationId: string): Promise<{ updated: number }> {
    const result = await prisma.socialNotification.updateMany({
      where: { organizationId, deletedAt: null, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: result.count };
  },

  /** Convenience helpers used at hook points. */

  approvalNeeded(organizationId: string, group: string, step: 'INTERNAL' | 'CLIENT') {
    const who = step === 'INTERNAL' ? 'internal review' : 'client approval';
    return this.create({
      organizationId,
      type: 'approval_needed',
      content: `A post is waiting for ${who} (group ${group.slice(0, 8)}…).`,
      link: `/dashboard/social/calendar`,
    });
  },

  postFailed(organizationId: string, postId: string, platform: string, message: string) {
    return this.create({
      organizationId,
      type: 'post_failed',
      content: `Publish failed on ${platform}: ${message.slice(0, 280)}`,
      link: `/dashboard/social/calendar`,
    });
  },

  tokenExpired(
    organizationId: string,
    channelName: string,
    link = '/dashboard/social/channels'
  ) {
    return this.create({
      organizationId,
      type: 'token_expired',
      content: `Reconnect required: "${channelName}" token expired or was revoked.`,
      link,
      dedupeHours: DEDUPE_HOURS,
    });
  },

  slaBreached(
    organizationId: string,
    content: string,
    link: string
  ) {
    return this.create({
      organizationId,
      type: 'sla_breached',
      content,
      link,
    });
  },

  budget80(organizationId: string, content: string, link?: string) {
    return this.create({
      organizationId,
      type: 'budget_80',
      content,
      link: link ?? '/dashboard/social/ads',
      dedupeHours: DEDUPE_HOURS,
    });
  },

  newLead(organizationId: string, source: string, leadId?: string) {
    return this.create({
      organizationId,
      type: 'new_lead',
      content: `New lead from ${source}.`,
      link: leadId
        ? `/dashboard/social/leads?lead=${leadId}`
        : '/dashboard/social/leads',
    });
  },
};
