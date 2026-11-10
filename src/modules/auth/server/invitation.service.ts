import 'server-only';
import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import { prisma } from '@/shared/lib/prisma';
import { getServerEnv } from '@/shared/lib/env';
import { HttpError } from '@/shared/server/http-error';
import { planService } from '@/modules/social/server/billing/plan.service';
import type { CurrentUser } from './session';
import type { Prisma } from '@/generated/prisma/client';
import { CLIENT_PERMISSION_IDS, type ClientAccessEntry, type ClientPermissionId } from '../config/client-permissions';
import type { CreateInvitationBody, SetMemberClientsBody } from './invitation.schema';

const isClientPermission = (value: string): value is ClientPermissionId =>
  (CLIENT_PERMISSION_IDS as readonly string[]).includes(value);

const BCRYPT_ROUNDS = 12;
const INVITE_TTL_MS = 72 * 60 * 60 * 1000; // 72h, matching the client magic link.

// The raw token lives only in the invite URL we hand back. We store its SHA-256 so a leaked
// database row cannot be turned back into a working link, while still letting us look an invite
// up by hashing the token the invitee presents.
function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

/** Keep only clients that exist (not deleted) in this organization; duplicate ids collapse. */
async function validClientAccess(
  db: Prisma.TransactionClient | typeof prisma,
  organizationId: string,
  entries: ClientAccessEntry[]
): Promise<ClientAccessEntry[]> {
  const unique = new Map(entries.map((entry) => [entry.customerId, entry]));
  if (unique.size === 0) return [];
  const found = await db.socialCustomer.findMany({
    where: { organizationId, deletedAt: null, id: { in: [...unique.keys()] } },
    select: { id: true },
  });
  const ok = new Set(found.map((row) => row.id));
  return [...unique.values()]
    .filter((entry) => ok.has(entry.customerId))
    .map((entry) => ({ customerId: entry.customerId, permissions: [...new Set(entry.permissions)] }));
}

async function assertEmailFree(email: string): Promise<void> {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new HttpError(409, 'Someone with this email already has an account');
  }
}

export const invitationService = {
  /**
   * Mint a one-time invite link for a new staff member. Returns the raw URL (shown once); the
   * invitee opens it, sets a name + password, and becomes a User in this organization.
   */
  async createInvitation(
    organizationId: string,
    invitedById: string,
    body: CreateInvitationBody
  ): Promise<{ inviteUrl: string; email: string; role: 'ADMIN' | 'MEMBER'; expiresAt: Date }> {
    await planService.assertUserCapacity(organizationId);
    await assertEmailFree(body.email);
    // ADMIN sees every client; only a MEMBER carries a client list.
    const clientAccess = body.role === 'MEMBER' ? await validClientAccess(prisma, organizationId, body.clientAccess) : [];

    const rawToken = randomBytes(32).toString('base64url');
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

    await prisma.$transaction(async (tx) => {
      // Replace any outstanding invite for the same person in this org so only the newest link works.
      await tx.invitation.deleteMany({
        where: { organizationId, email: body.email, acceptedAt: null },
      });
      await tx.invitation.create({
        data: {
          organizationId,
          email: body.email,
          role: body.role,
          clientAccess: clientAccess as unknown as Prisma.InputJsonValue,
          tokenHash,
          invitedById,
          expiresAt,
        },
      });
    });

    const inviteUrl = `${getServerEnv().APP_URL}/invite?token=${rawToken}`;
    return { inviteUrl, email: body.email, role: body.role, expiresAt };
  },

  /** Active staff logins in the organization, oldest first, with the clients each MEMBER can see. */
  async listMembers(organizationId: string) {
    const users = await prisma.user.findMany({
      where: { organizationId, deletedAt: null },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        lastLoginAt: true,
        createdAt: true,
        clientMemberships: {
          where: { organizationId, customer: { deletedAt: null } },
          select: { customerId: true, permissions: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    return users.map(({ clientMemberships, ...user }) => ({
      ...user,
      clients: clientMemberships.map((m) => ({
        customerId: m.customerId,
        permissions: (Array.isArray(m.permissions) ? (m.permissions as string[]) : []).filter(isClientPermission),
      })),
    }));
  },

  /** Clients the Team page can hand out (every live client in the organization). */
  async listAssignableClients(organizationId: string) {
    return prisma.socialCustomer.findMany({
      where: { organizationId, deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  },

  /**
   * Replace a member's client list. Clients left out lose access; listed ones are created or get
   * the new permission set. Only MEMBER logins carry a list — OWNER/ADMIN always see everything.
   */
  async setMemberClients(organizationId: string, userId: string, body: SetMemberClientsBody) {
    const user = await prisma.user.findFirst({
      where: { id: userId, organizationId, deletedAt: null },
      select: { id: true, role: true },
    });
    if (!user) throw new HttpError(404, 'Team member not found');
    if (user.role !== 'MEMBER') {
      throw new HttpError(400, 'Owners and admins already see every client. Only members get a client list.');
    }

    return prisma.$transaction(async (tx) => {
      const entries = await validClientAccess(tx, organizationId, body.clients);
      await tx.socialClientMember.deleteMany({
        where: { userId, organizationId, customerId: { notIn: entries.map((e) => e.customerId) } },
      });
      for (const entry of entries) {
        await tx.socialClientMember.upsert({
          where: { userId_customerId: { userId, customerId: entry.customerId } },
          create: { organizationId, userId, customerId: entry.customerId, permissions: entry.permissions },
          update: { permissions: entry.permissions },
        });
      }
      return entries;
    });
  },

  /** Invites that have neither been accepted nor expired. */
  async listPendingInvitations(organizationId: string) {
    return prisma.invitation.findMany({
      where: { organizationId, acceptedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true, email: true, role: true, expiresAt: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  },

  async revokeInvitation(organizationId: string, invitationId: string): Promise<void> {
    const invite = await prisma.invitation.findFirst({
      where: { id: invitationId, organizationId, acceptedAt: null },
      select: { id: true },
    });
    if (!invite) throw new HttpError(404, 'Invite not found');
    await prisma.invitation.delete({ where: { id: invite.id } });
  },

  /** Read-only preview for the accept page: who the invite is for, without consuming it. */
  async previewInvitation(rawToken: string): Promise<{ email: string; role: string; organizationName: string }> {
    const invite = await prisma.invitation.findUnique({
      where: { tokenHash: hashToken(rawToken) },
      include: { organization: { select: { name: true } } },
    });
    if (!invite || invite.acceptedAt || invite.expiresAt.getTime() < Date.now()) {
      throw new HttpError(400, 'This invite link is invalid or has expired. Ask for a new one.');
    }
    return { email: invite.email, role: invite.role, organizationName: invite.organization.name };
  },

  /**
   * Consume an invite: create the User, mark the invite accepted. Returns the user (with its
   * organization) so the route can open a session. Throws if the link is spent/expired or the
   * email was claimed in the meantime.
   */
  async acceptInvitation(
    rawToken: string,
    details: { name: string; password: string }
  ): Promise<CurrentUser> {
    const tokenHash = hashToken(rawToken);

    return prisma.$transaction(async (tx) => {
      const invite = await tx.invitation.findUnique({ where: { tokenHash } });
      if (!invite || invite.acceptedAt || invite.expiresAt.getTime() < Date.now()) {
        throw new HttpError(400, 'This invite link is invalid or has expired. Ask for a new one.');
      }
      if (await tx.user.findUnique({ where: { email: invite.email } })) {
        throw new HttpError(409, 'Someone with this email already has an account');
      }

      const user = await tx.user.create({
        data: {
          organizationId: invite.organizationId,
          name: details.name,
          email: invite.email,
          passwordHash: await bcrypt.hash(details.password, BCRYPT_ROUNDS),
          role: invite.role,
        },
        include: { organization: true },
      });

      // Give the new MEMBER the clients chosen on the invite (skipping any deleted since).
      if (invite.role === 'MEMBER' && Array.isArray(invite.clientAccess)) {
        const entries = await validClientAccess(
          tx,
          invite.organizationId,
          invite.clientAccess as unknown as ClientAccessEntry[]
        );
        for (const entry of entries) {
          await tx.socialClientMember.create({
            data: {
              organizationId: invite.organizationId,
              userId: user.id,
              customerId: entry.customerId,
              permissions: entry.permissions,
            },
          });
        }
      }

      await tx.invitation.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } });
      return user;
    });
  },
};
