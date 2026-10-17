import 'server-only';
import type { SocialApprovalStep } from '@/generated/prisma/client';
import { prisma } from '@/shared/lib/prisma';
import { getServerEnv } from '@/shared/lib/env';
import { SignJWT, jwtVerify } from 'jose';
import { requireClient } from '@/shared/server/access';
import { scopeWhere, type ClientScope } from '@/shared/server/client-scope';
import { HttpError } from '@/shared/server/http-error';
import { logAudit } from '@/shared/server/audit.service';
import { publishQueue } from '../publishing/publish.queue';

/**
 * Two distinct, non-interchangeable token kinds, both signed with SESSION_SECRET but tagged
 * with a different `aud` so one can never be accepted in place of the other (see PODO_SOCIAL_CLIENT_PLAN.md,
 * section 8.2, problems C4/C5/C6):
 *
 * - "approver-link": the one-time magic link sent to the client. Short-lived (72h), carries the
 *   approver's `tokenVersion` at mint time, and is consumed (tokenVersion bumped) on first verify —
 *   so it can never be replayed, and generating a new link invalidates any outstanding one.
 * - "approver-session": the renewable browser session minted the moment a link is redeemed.
 *   Short-lived (12h); re-checked against the database on every use, so deleting the approver
 *   stops it immediately even if the cookie hasn't expired yet.
 */
const LINK_AUDIENCE = 'podo-social:approver-link';
const SESSION_AUDIENCE = 'podo-social:approver-session';
const ISSUER = 'podo-social';

const SECRET = new TextEncoder().encode(getServerEnv().SESSION_SECRET);

export type ApprovalAction = 'submit_internal' | 'submit_client' | 'approve' | 'reject';

export interface PortalSession {
  approverId: string;
  organizationId: string;
  customerId: string;
}

async function loadApprover(approverId: string) {
  const approver = await prisma.clientApprover.findUnique({ where: { id: approverId } });
  if (!approver) {
    // Covers "removed approver's link/session stop working immediately": once the row is gone,
    // no token for it verifies, regardless of its own expiry.
    throw new HttpError(401, 'This approver no longer has access');
  }
  return approver;
}

async function loadDraftGroup(scope: ClientScope, group: string) {
  const rows = await prisma.socialPost.findMany({
    where: { ...scopeWhere(scope), group, deletedAt: null },
    select: {
      id: true,
      group: true,
      state: true,
      approvalStep: true,
      customerId: true,
      parentPostId: true,
      publishDate: true,
    },
  });
  if (rows.length === 0) {
    throw new HttpError(404, 'Post not found');
  }
  if (rows.some((row) => row.state !== 'DRAFT')) {
    throw new HttpError(400, 'Only drafts can enter the approval workflow');
  }
  const customerId = rows[0].customerId;
  if (!customerId || rows.some((row) => row.customerId !== customerId)) {
    throw new HttpError(400, 'Post must belong to a single client before approval');
  }
  return { rows, customerId };
}

async function setGroupStep(
  organizationId: string,
  group: string,
  data: {
    approvalStep: SocialApprovalStep;
    state?: 'DRAFT' | 'QUEUE';
    error?: string | null;
  }
) {
  await prisma.socialPost.updateMany({
    where: { organizationId, group, deletedAt: null },
    data: {
      approvalStep: data.approvalStep,
      ...(data.state ? { state: data.state } : {}),
      ...(data.error !== undefined ? { error: data.error } : {}),
    },
  });
}

async function queueApprovedGroup(organizationId: string, group: string) {
  const roots = await prisma.socialPost.findMany({
    where: {
      organizationId,
      group,
      deletedAt: null,
      parentPostId: null,
      state: 'QUEUE',
    },
    select: { id: true, publishDate: true },
  });
  try {
    await publishQueue.schedule(
      roots.map((row) => ({ postId: row.id, publishDate: row.publishDate, runAt: row.publishDate }))
    );
  } catch (error) {
    console.error(`[social] could not queue approved post group ${group}`, error);
  }
}

export const approvalService = {
  /** Mint the one-time link sent to the client (e.g. by email/WhatsApp). Never store the raw token. */
  async generateMagicLink(approverId: string): Promise<string> {
    const approver = await loadApprover(approverId);

    const token = await new SignJWT({
      sub: approver.id,
      org: approver.organizationId,
      cust: approver.customerId,
      ver: approver.tokenVersion,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setIssuer(ISSUER)
      .setAudience(LINK_AUDIENCE)
      .setExpirationTime('72h')
      .sign(SECRET);

    return `${getServerEnv().APP_URL}/api/approver/verify?token=${token}`;
  },

  /**
   * Verify and CONSUME a one-time magic link. Call this exactly once, from the verify route,
   * then immediately mint a session with `createPortalSession`. Throws on an invalid, expired,
   * already-used or revoked link.
   */
  async verifyApproverLink(token: string): Promise<PortalSession> {
    let payload;
    try {
      ({ payload } = await jwtVerify(token, SECRET, { issuer: ISSUER, audience: LINK_AUDIENCE }));
    } catch {
      throw new HttpError(401, 'Invalid or expired magic link');
    }

    const approverId = payload.sub as string;
    const approver = await loadApprover(approverId);

    if (payload.ver !== approver.tokenVersion) {
      // Either already used, or a newer link was generated since (which also bumps tokenVersion).
      throw new HttpError(401, 'This magic link has already been used. Ask for a new one.');
    }

    // Atomically consume it: any copy of this exact link now fails the version check above.
    await prisma.clientApprover.update({
      where: { id: approver.id },
      data: { tokenVersion: { increment: 1 }, lastSeenAt: new Date() },
    });

    return { approverId: approver.id, organizationId: approver.organizationId, customerId: approver.customerId };
  },

  /** Mint a renewable portal session after a magic link has been redeemed. */
  async createPortalSession(session: PortalSession): Promise<string> {
    const approver = await loadApprover(session.approverId);
    return new SignJWT({
      sub: session.approverId,
      org: session.organizationId,
      cust: session.customerId,
      ver: approver.tokenVersion,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setIssuer(ISSUER)
      .setAudience(SESSION_AUDIENCE)
      .setExpirationTime('12h')
      .sign(SECRET);
  },

  /** Verify a portal session cookie. Re-checks the approver still exists, and that they have not
   *  since been revoked, on every call. */
  async verifyPortalSession(token: string): Promise<PortalSession> {
    let payload;
    try {
      ({ payload } = await jwtVerify(token, SECRET, { issuer: ISSUER, audience: SESSION_AUDIENCE }));
    } catch {
      throw new HttpError(401, 'Invalid or expired session');
    }

    const approverId = payload.sub as string;
    const approver = await loadApprover(approverId);
    if (payload.ver !== approver.tokenVersion) {
      throw new HttpError(401, 'This session was revoked. Ask for a new magic link.');
    }
    return { approverId: approver.id, organizationId: approver.organizationId, customerId: approver.customerId };
  },

  /** Revoke every outstanding link and session for an approver immediately (e.g. when removing
   *  them from a client, without waiting for their session to expire). */
  async revokeApprover(approverId: string): Promise<void> {
    await prisma.clientApprover.update({
      where: { id: approverId },
      data: { tokenVersion: { increment: 1 } },
    });
  },

  /**
   * Agency workflow actions. Requires `approve` on the post's client.
   * - submit_internal: draft → INTERNAL (optional step)
   * - submit_client: draft / INTERNAL / REJECTED → CLIENT
   * - approve (at INTERNAL): → CLIENT
   * - reject (at INTERNAL or CLIENT): → REJECTED
   */
  async agencyAction(
    scope: ClientScope,
    group: string,
    action: ApprovalAction,
    reason?: string
  ): Promise<{ approvalStep: SocialApprovalStep }> {
    const { rows, customerId } = await loadDraftGroup(scope, group);
    await requireClient(customerId, 'approve');

    const step = rows[0].approvalStep;

    if (action === 'submit_internal') {
      if (step !== null && step !== 'REJECTED') {
        throw new HttpError(400, 'Post is already in an approval step');
      }
      await setGroupStep(scope.organizationId, group, {
        approvalStep: 'INTERNAL',
        error: null,
      });
      await logAudit({
        action: 'approval.submit_internal',
        targetType: 'post_group',
        targetId: group,
        metadata: { customerId },
      });
      return { approvalStep: 'INTERNAL' };
    }

    if (action === 'submit_client') {
      if (step === 'CLIENT' || step === 'APPROVED') {
        throw new HttpError(400, 'Post is already waiting for the client or approved');
      }
      await setGroupStep(scope.organizationId, group, {
        approvalStep: 'CLIENT',
        error: null,
      });
      await logAudit({
        action: 'approval.submit_client',
        targetType: 'post_group',
        targetId: group,
        metadata: { customerId },
      });
      return { approvalStep: 'CLIENT' };
    }

    if (action === 'approve') {
      if (step !== 'INTERNAL') {
        throw new HttpError(400, 'Only posts in internal review can be approved by the agency');
      }
      await setGroupStep(scope.organizationId, group, {
        approvalStep: 'CLIENT',
        error: null,
      });
      await logAudit({
        action: 'approval.internal_approve',
        targetType: 'post_group',
        targetId: group,
        metadata: { customerId },
      });
      return { approvalStep: 'CLIENT' };
    }

    if (action === 'reject') {
      if (step !== 'INTERNAL' && step !== 'CLIENT') {
        throw new HttpError(400, 'Only posts in review can be rejected');
      }
      const trimmed = reason?.trim();
      if (!trimmed) {
        throw new HttpError(400, 'A rejection reason is required');
      }
      await setGroupStep(scope.organizationId, group, {
        approvalStep: 'REJECTED',
        error: trimmed,
      });
      await logAudit({
        action: 'approval.reject',
        targetType: 'post_group',
        targetId: group,
        metadata: { customerId, reason: trimmed, fromStep: step },
      });
      return { approvalStep: 'REJECTED' };
    }

    throw new HttpError(400, 'Unknown approval action');
  },

  /**
   * Client portal decide. Only posts at CLIENT step for this customer are visible / mutable.
   */
  async portalDecide(
    session: PortalSession,
    group: string,
    action: 'approve' | 'reject',
    reason?: string
  ): Promise<{ approvalStep: SocialApprovalStep }> {
    const rows = await prisma.socialPost.findMany({
      where: {
        organizationId: session.organizationId,
        customerId: session.customerId,
        group,
        deletedAt: null,
        state: 'DRAFT',
        approvalStep: 'CLIENT',
      },
      select: { id: true, parentPostId: true, publishDate: true },
    });
    if (rows.length === 0) {
      throw new HttpError(404, 'Post not found or not waiting for client approval');
    }

    if (action === 'approve') {
      await setGroupStep(session.organizationId, group, {
        approvalStep: 'APPROVED',
        state: 'QUEUE',
        error: null,
      });
      await queueApprovedGroup(session.organizationId, group);
      await logAudit({
        action: 'approval.client_approve',
        targetType: 'post_group',
        targetId: group,
        metadata: {
          customerId: session.customerId,
          approverId: session.approverId,
        },
      });
      return { approvalStep: 'APPROVED' };
    }

    const trimmed = reason?.trim() || 'Changes requested by client';
    await setGroupStep(session.organizationId, group, {
      approvalStep: 'REJECTED',
      error: trimmed,
    });
    await logAudit({
      action: 'approval.client_reject',
      targetType: 'post_group',
      targetId: group,
      metadata: {
        customerId: session.customerId,
        approverId: session.approverId,
        reason: trimmed,
      },
    });
    return { approvalStep: 'REJECTED' };
  },

  /** Posts waiting on the magic-link portal for this client (CLIENT step only). */
  async listPortalQueue(session: PortalSession) {
    return prisma.socialPost.findMany({
      where: {
        organizationId: session.organizationId,
        customerId: session.customerId,
        state: 'DRAFT',
        approvalStep: 'CLIENT',
        deletedAt: null,
        parentPostId: null,
      },
      include: { integration: true },
      orderBy: { publishDate: 'asc' },
    });
  },
};
