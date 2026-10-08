import 'server-only';
import { prisma } from '@/shared/lib/prisma';
import { getServerEnv } from '@/shared/lib/env';
import { SignJWT, jwtVerify } from 'jose';
import { HttpError } from '@/shared/server/http-error';

const SECRET = new TextEncoder().encode(getServerEnv().SESSION_SECRET);

export const approvalService = {
  async generateMagicLink(approverId: string): Promise<string> {
    const approver = await prisma.clientApprover.findUnique({ where: { id: approverId } });
    if (!approver) {
      throw new HttpError(404, 'Approver not found');
    }

    const token = await new SignJWT({ sub: approver.id, org: approver.organizationId, cust: approver.customerId })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(SECRET);

    return `${getServerEnv().APP_URL}/api/approver/verify?token=${token}`;
  },

  async verifyToken(token: string) {
    try {
      const { payload } = await jwtVerify(token, SECRET);
      return {
        approverId: payload.sub as string,
        organizationId: payload.org as string,
        customerId: payload.cust as string,
      };
    } catch (err) {
      throw new HttpError(401, 'Invalid or expired magic link');
    }
  }
};
