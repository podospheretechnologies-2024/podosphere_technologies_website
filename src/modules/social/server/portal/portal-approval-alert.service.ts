import 'server-only';
import { prisma } from '@/shared/lib/prisma';
import { getServerEnv } from '@/shared/lib/env';
import { sendNotificationEmail } from '@/shared/server/mailer';
import { organizationScope } from '@/shared/server/client-scope';
import { whatsappService } from '../whatsapp/whatsapp.service';

function portalUrl(): string {
  return `${getServerEnv().APP_URL.replace(/\/$/, '')}/portal/content`;
}

function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  return digits.length >= 10 ? digits : null;
}

/**
 * When a post hits CLIENT approval: email every enabled portal login for that client,
 * and soft-send WhatsApp text when a phone is set + WhatsApp is connected.
 */
export const portalApprovalAlertService = {
  async notifyClientApprovalNeeded(
    organizationId: string,
    customerId: string,
    group: string
  ): Promise<void> {
    const [approvers, customer, waiting] = await Promise.all([
      prisma.clientApprover.findMany({
        where: { organizationId, customerId, disabledAt: null },
        select: { email: true, name: true, phone: true },
      }),
      prisma.socialCustomer.findFirst({
        where: { id: customerId, organizationId, deletedAt: null },
        select: { name: true },
      }),
      prisma.socialPost.count({
        where: {
          organizationId,
          customerId,
          deletedAt: null,
          parentPostId: null,
          state: 'DRAFT',
          approvalStep: 'CLIENT',
        },
      }),
    ]);

    if (approvers.length === 0) return;

    const brand = customer?.name ?? 'your brand';
    const countLabel = waiting <= 1 ? '1 post is' : `${waiting} posts are`;
    const subject = `${countLabel} waiting for your approval`;
    const body = `${countLabel} waiting for your approval for ${brand}. Open the portal to review: ${portalUrl()}`;
    const link = portalUrl();

    const emails = approvers.map((row) => row.email).filter(Boolean);
    if (emails.length > 0) {
      await sendNotificationEmail({
        to: emails,
        subject: `[Client portal] ${subject}`,
        title: subject,
        body: `Hi,\n\n${body}\n\n(Post group ${group.slice(0, 8)}…)`,
        actionUrl: link,
        actionLabel: 'Open portal',
      }).catch((err) => console.error('[portal-alert] email soft-fail', err));
    }

    const phones = [
      ...new Set(approvers.map((row) => normalizePhone(row.phone)).filter(Boolean)),
    ] as string[];
    if (phones.length === 0) return;

    const scope = organizationScope(organizationId, customerId);
    for (const phone of phones) {
      try {
        await whatsappService.send(scope, {
          type: 'text',
          to: phone,
          text: body,
        });
      } catch (err) {
        // Outside 24h window / no connection — never block the approval workflow.
        console.error('[portal-alert] whatsapp soft-fail', phone, err);
      }
    }
  },
};
