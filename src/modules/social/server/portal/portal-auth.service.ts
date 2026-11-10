import 'server-only';
import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import { prisma } from '@/shared/lib/prisma';
import { getServerEnv } from '@/shared/lib/env';
import { redis } from '@/shared/lib/redis';
import { HttpError } from '@/shared/server/http-error';
import { sendEmail } from '@/shared/server/mailer';
import {
  customDomainFromHost,
  orgSlugFromHost,
} from '@/shared/server/org-branding';
import {
  approvalService,
  type PortalSession,
  type PortalSessionTtl,
} from '../approvals/approval.service';
import type {
  CreatePortalApproverBody,
  PortalChangePasswordBody,
  PortalLoginBody,
  PortalSetPasswordBody,
} from './portal-auth.schema';

const BCRYPT_ROUNDS = 12;
const SET_PASSWORD_AUDIENCE = 'podo-social:approver-set-password';
const ISSUER = 'podo-social';
const LOGIN_RATE_LIMIT = 10;
const LOGIN_RATE_WINDOW_SECONDS = 15 * 60;
const GENERIC_LOGIN_ERROR = 'Invalid email or password';

const SECRET = new TextEncoder().encode(getServerEnv().SESSION_SECRET);

let dummyHashPromise: Promise<string> | undefined;
function dummyHash(): Promise<string> {
  dummyHashPromise ??= bcrypt.hash('podo-dummy-portal-password', BCRYPT_ROUNDS);
  return dummyHashPromise;
}

export type PortalApproverListItem = {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  hasPassword: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  lastSeenAt: string | null;
  disabledAt: string | null;
  createdAt: string;
};

function hashGeneratedPassword(): string {
  // Readable enough to type once, long enough to be unique.
  return randomBytes(9).toString('base64url');
}

function toListItem(row: {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  passwordHash: string | null;
  mustChangePassword: boolean;
  lastLoginAt: Date | null;
  lastSeenAt: Date | null;
  disabledAt: Date | null;
  createdAt: Date;
}): PortalApproverListItem {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    phone: row.phone,
    hasPassword: Boolean(row.passwordHash),
    mustChangePassword: row.mustChangePassword,
    lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
    lastSeenAt: row.lastSeenAt?.toISOString() ?? null,
    disabledAt: row.disabledAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

async function resolveOrganizationIdFromHost(host: string | null): Promise<string | null> {
  const slug = orgSlugFromHost(host);
  if (slug) {
    const org = await prisma.organization.findFirst({
      where: { slug, deletedAt: null },
      select: { id: true },
    });
    return org?.id ?? null;
  }
  const domain = customDomainFromHost(host);
  if (domain) {
    const org = await prisma.organization.findFirst({
      where: { customDomain: domain, deletedAt: null },
      select: { id: true },
    });
    return org?.id ?? null;
  }
  return null;
}

async function assertLoginRateLimit(key: string): Promise<void> {
  const redisKey = `portal-login:${key}`;
  try {
    const used = await redis.incr(redisKey);
    if (used === 1) {
      await redis.expire(redisKey, LOGIN_RATE_WINDOW_SECONDS);
    }
    if (used > LOGIN_RATE_LIMIT) {
      throw new HttpError(429, 'Too many login attempts. Try again in a few minutes.');
    }
  } catch (error) {
    if (error instanceof HttpError) throw error;
    // Redis down should not unlock unlimited attempts forever — still allow login,
    // but log so ops can notice.
    console.error('[portal-auth] rate limit unavailable', error);
  }
}

async function loadApproverInOrg(organizationId: string, customerId: string, approverId: string) {
  const approver = await prisma.clientApprover.findFirst({
    where: { id: approverId, organizationId, customerId },
  });
  if (!approver) {
    throw new HttpError(404, 'Portal login not found');
  }
  return approver;
}

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export const portalAuthService = {
  async listApprovers(organizationId: string, customerId: string): Promise<PortalApproverListItem[]> {
    const rows = await prisma.clientApprover.findMany({
      where: { organizationId, customerId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toListItem);
  },

  async createApprover(
    organizationId: string,
    customerId: string,
    body: CreatePortalApproverBody
  ): Promise<PortalApproverListItem> {
    const customer = await prisma.socialCustomer.findFirst({
      where: { id: customerId, organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!customer) throw new HttpError(404, 'Client not found');

    const existing = await prisma.clientApprover.findFirst({
      where: { organizationId, email: body.email },
      select: { id: true, customerId: true },
    });
    if (existing) {
      throw new HttpError(
        409,
        existing.customerId === customerId
          ? 'That email already has portal access for this client'
          : 'That email already has portal access for another client in this workspace'
      );
    }

    const row = await prisma.clientApprover.create({
      data: {
        organizationId,
        customerId,
        email: body.email,
        name: body.name,
        phone: body.phone ?? null,
      },
    });
    return toListItem(row);
  },

  async updateApprover(
    organizationId: string,
    customerId: string,
    approverId: string,
    patch: { disabled?: boolean; phone?: string | null }
  ): Promise<PortalApproverListItem> {
    const approver = await loadApproverInOrg(organizationId, customerId, approverId);
    const updated = await prisma.clientApprover.update({
      where: { id: approver.id },
      data: {
        ...(patch.disabled !== undefined
          ? {
              disabledAt: patch.disabled ? new Date() : null,
              ...(patch.disabled ? { tokenVersion: { increment: 1 } } : {}),
            }
          : {}),
        ...(patch.phone !== undefined ? { phone: patch.phone } : {}),
      },
    });
    return toListItem(updated);
  },

  /**
   * Agency: mint a one-time temporary password. Returned only here — never logged or stored plain.
   */
  async generatePassword(
    organizationId: string,
    customerId: string,
    approverId: string
  ): Promise<{ password: string; approver: PortalApproverListItem }> {
    const approver = await loadApproverInOrg(organizationId, customerId, approverId);
    if (approver.disabledAt) {
      throw new HttpError(400, 'Re-enable this login before generating a password');
    }

    const password = hashGeneratedPassword();
    const updated = await prisma.clientApprover.update({
      where: { id: approver.id },
      data: {
        passwordHash: await hashPassword(password),
        mustChangePassword: true,
        // Invalidate outstanding magic-link sessions so the new password is the path in.
        tokenVersion: { increment: 1 },
      },
    });

    return { password, approver: toListItem(updated) };
  },

  /** Agency: email a set-your-password link (72h, one-time via tokenVersion). */
  async sendSetPasswordLink(
    organizationId: string,
    customerId: string,
    approverId: string
  ): Promise<{ sent: boolean; link?: string }> {
    const approver = await loadApproverInOrg(organizationId, customerId, approverId);
    if (approver.disabledAt) {
      throw new HttpError(400, 'Re-enable this login before sending a set-password link');
    }

    const token = await new SignJWT({
      sub: approver.id,
      org: approver.organizationId,
      cust: approver.customerId,
      ver: approver.tokenVersion,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setIssuer(ISSUER)
      .setAudience(SET_PASSWORD_AUDIENCE)
      .setExpirationTime('72h')
      .sign(SECRET);

    const link = `${getServerEnv().APP_URL}/client/set-password?token=${token}`;
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true, portalTitle: true },
    });
    const title = org?.portalTitle?.trim() || org?.name || 'Client Portal';

    const result = await sendEmail({
      to: approver.email,
      subject: `Set your password for ${title}`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:560px;line-height:1.5;color:#111">
          <h1 style="font-size:18px;margin:0 0 12px">Set your portal password</h1>
          <p style="margin:0 0 8px">Hi${approver.name ? ` ${escapeHtml(approver.name)}` : ''},</p>
          <p style="margin:0 0 16px">Use the button below to choose a password for ${escapeHtml(title)}. This link expires in 72 hours.</p>
          <p style="margin:24px 0">
            <a href="${escapeHtml(link)}" style="background:#111;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">Set password</a>
          </p>
          <p style="margin:32px 0 0;font-size:12px;color:#666">If you did not expect this, ignore the email.</p>
        </div>
      `,
    });

    return {
      sent: result.ok === true,
      // When email is not configured (local/dev), return the link so agency can copy it.
      ...(!result.ok ? { link } : {}),
    };
  },

  async setDisabled(
    organizationId: string,
    customerId: string,
    approverId: string,
    disabled: boolean
  ): Promise<PortalApproverListItem> {
    const approver = await loadApproverInOrg(organizationId, customerId, approverId);
    const updated = await prisma.clientApprover.update({
      where: { id: approver.id },
      data: {
        disabledAt: disabled ? new Date() : null,
        ...(disabled ? { tokenVersion: { increment: 1 } } : {}),
      },
    });
    return toListItem(updated);
  },

  async login(
    body: PortalLoginBody,
    opts: { host: string | null; ip: string | null }
  ): Promise<{ session: PortalSession; ttl: PortalSessionTtl }> {
    const emailKey = createHash('sha256').update(body.email).digest('hex').slice(0, 32);
    await assertLoginRateLimit(`email:${emailKey}`);
    if (opts.ip) {
      await assertLoginRateLimit(`ip:${opts.ip}`);
    }

    const organizationId = await resolveOrganizationIdFromHost(opts.host);
    const candidates = await prisma.clientApprover.findMany({
      where: {
        email: body.email,
        ...(organizationId ? { organizationId } : {}),
        passwordHash: { not: null },
        disabledAt: null,
      },
    });

    if (candidates.length > 1) {
      // Same email in multiple orgs — force white-label / agency URL so we know which one.
      await dummyHash();
      throw new HttpError(400, 'Open your agency portal URL to log in, then try again.');
    }

    const approver = candidates[0] ?? null;
    const valid = await bcrypt.compare(body.password, approver?.passwordHash ?? (await dummyHash()));
    if (!approver || !valid) {
      throw new HttpError(401, GENERIC_LOGIN_ERROR);
    }

    const updated = await prisma.clientApprover.update({
      where: { id: approver.id },
      data: { lastLoginAt: new Date(), lastSeenAt: new Date() },
    });

    return {
      session: {
        approverId: updated.id,
        organizationId: updated.organizationId,
        customerId: updated.customerId,
        mustChangePassword: updated.mustChangePassword,
      },
      ttl: body.rememberMe ? '30d' : '7d',
    };
  },

  async changePassword(session: PortalSession, body: PortalChangePasswordBody): Promise<void> {
    const approver = await prisma.clientApprover.findFirst({
      where: {
        id: session.approverId,
        organizationId: session.organizationId,
        customerId: session.customerId,
        disabledAt: null,
      },
    });
    if (!approver) {
      throw new HttpError(401, 'Please sign in again');
    }

    if (!approver.mustChangePassword) {
      if (!body.currentPassword) {
        throw new HttpError(400, 'Enter your current password');
      }
      const ok = await bcrypt.compare(body.currentPassword, approver.passwordHash ?? (await dummyHash()));
      if (!ok) {
        throw new HttpError(401, 'Current password is incorrect');
      }
    }

    await prisma.clientApprover.update({
      where: { id: approver.id },
      data: {
        passwordHash: await hashPassword(body.password),
        mustChangePassword: false,
        tokenVersion: { increment: 1 },
        lastSeenAt: new Date(),
      },
    });
  },

  async setPasswordFromLink(body: PortalSetPasswordBody): Promise<PortalSession> {
    let payload;
    try {
      ({ payload } = await jwtVerify(body.token, SECRET, {
        issuer: ISSUER,
        audience: SET_PASSWORD_AUDIENCE,
      }));
    } catch {
      throw new HttpError(401, 'Invalid or expired set-password link');
    }

    const approverId = payload.sub as string;
    const approver = await prisma.clientApprover.findUnique({ where: { id: approverId } });
    if (!approver || approver.disabledAt) {
      throw new HttpError(401, 'This login is no longer available');
    }
    if (payload.ver !== approver.tokenVersion) {
      throw new HttpError(401, 'This set-password link has already been used. Ask for a new one.');
    }
    if (payload.org !== approver.organizationId || payload.cust !== approver.customerId) {
      throw new HttpError(401, 'Invalid or expired set-password link');
    }

    const updated = await prisma.clientApprover.update({
      where: { id: approver.id },
      data: {
        passwordHash: await hashPassword(body.password),
        mustChangePassword: false,
        tokenVersion: { increment: 1 },
        lastLoginAt: new Date(),
        lastSeenAt: new Date(),
      },
    });

    return {
      approverId: updated.id,
      organizationId: updated.organizationId,
      customerId: updated.customerId,
      mustChangePassword: false,
    };
  },

  /** Mint session JWT after password login / set-password — same cookie as magic link. */
  async mintSession(
    session: Pick<PortalSession, 'approverId' | 'organizationId' | 'customerId'>,
    ttl: PortalSessionTtl
  ): Promise<string> {
    return approvalService.createPortalSession(session, ttl);
  },
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
