import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { redis } from '@/shared/lib/redis';
import { HttpError } from '@/shared/server/http-error';
import { planService } from '../billing/plan.service';

export const API_PERMISSIONS = ['posts:write', 'analytics:read', 'leads:read', 'whatsapp:send'] as const;
export type ApiPermission = (typeof API_PERMISSIONS)[number];

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function ipAllowed(allowlist: string | null, ip: string | null): boolean {
  if (!allowlist?.trim()) return true;
  if (!ip) return false;
  return allowlist
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .some((rule) => ip === rule || ip.startsWith(rule.replace(/\/\d+$/, '')));
}

export const apiClientService = {
  async list(organizationId: string) {
    const rows = await prisma.socialApiClient.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      tokenPrefix: row.tokenPrefix,
      permissions: row.permissions,
      dailyLimit: row.dailyLimit,
      ipAllowlist: row.ipAllowlist,
      status: row.status,
      lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    }));
  },

  async create(
    organizationId: string,
    input: { name: string; permissions: string[]; dailyLimit?: number; ipAllowlist?: string }
  ) {
    await planService.assertFeature(organizationId, 'api');
    const permissions = input.permissions.filter((item): item is ApiPermission =>
      (API_PERMISSIONS as readonly string[]).includes(item)
    );
    if (permissions.length === 0) {
      throw new HttpError(400, 'Choose at least one permission');
    }
    const secret = `ps_live_${randomBytes(24).toString('base64url')}`;
    const row = await prisma.socialApiClient.create({
      data: {
        organizationId,
        name: input.name.trim(),
        tokenHash: hashToken(secret),
        tokenPrefix: secret.slice(0, 12),
        permissions,
        dailyLimit: input.dailyLimit ?? 1000,
        ipAllowlist: input.ipAllowlist?.trim() || null,
      },
    });
    return { id: row.id, token: secret, tokenPrefix: row.tokenPrefix };
  },

  async revoke(organizationId: string, id: string) {
    const updated = await prisma.socialApiClient.updateMany({
      where: { id, organizationId },
      data: { status: 'revoked' },
    });
    if (updated.count === 0) {
      throw new HttpError(404, 'API client not found');
    }
  },
};

export async function withApiKey(
  permission: ApiPermission,
  request: NextRequest,
  handler: (ctx: { organizationId: string }) => Promise<Response>
): Promise<Response> {
  const header = request.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) {
    throw new HttpError(401, 'Missing API key');
  }
  const client = await prisma.socialApiClient.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!client || client.status !== 'active') {
    throw new HttpError(401, 'API key is invalid or revoked');
  }
  const permissions = Array.isArray(client.permissions) ? (client.permissions as string[]) : [];
  if (!permissions.includes(permission)) {
    throw new HttpError(403, `API key is missing ${permission}`);
  }
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
  if (!ipAllowed(client.ipAllowlist, ip)) {
    throw new HttpError(403, 'IP is not allowed for this key');
  }
  const day = new Date().toISOString().slice(0, 10);
  const counterKey = `api:${client.id}:${day}`;
  const used = await redis.incr(counterKey);
  if (used === 1) {
    await redis.expire(counterKey, 60 * 60 * 48);
  }
  if (used > client.dailyLimit) {
    throw new HttpError(429, 'Daily API limit reached');
  }

  const response = await handler({ organizationId: client.organizationId });
  void prisma.socialApiClient
    .update({ where: { id: client.id }, data: { lastUsedAt: new Date() } })
    .catch(() => undefined);
  void prisma.socialApiUsageLog
    .create({
      data: {
        apiClientId: client.id,
        path: request.nextUrl.pathname,
        statusCode: response.status,
      },
    })
    .catch(() => undefined);
  return response;
}
