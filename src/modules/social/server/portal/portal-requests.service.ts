import 'server-only';
import { prisma } from '@/shared/lib/prisma';
import { HttpError } from '@/shared/server/http-error';
import type { PortalSession } from '../approvals/approval.service';
import type { CreatePortalRequestBody, UpdatePortalRequestBody } from './portal-requests.schema';

export type PortalRequestRow = {
  id: string;
  type: string;
  title: string;
  detail: string | null;
  status: string;
  reply: string | null;
  createdAt: string;
  updatedAt: string;
};

function mapRow(row: {
  id: string;
  type: string;
  title: string;
  detail: string | null;
  status: string;
  reply: string | null;
  createdAt: Date;
  updatedAt: Date;
}): PortalRequestRow {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    detail: row.detail,
    status: row.status,
    reply: row.reply,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export const portalRequestsService = {
  async listForPortal(session: PortalSession): Promise<PortalRequestRow[]> {
    const rows = await prisma.socialPortalRequest.findMany({
      where: {
        organizationId: session.organizationId,
        customerId: session.customerId,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        type: true,
        title: true,
        detail: true,
        status: true,
        reply: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return rows.map(mapRow);
  },

  async createForPortal(session: PortalSession, body: CreatePortalRequestBody): Promise<PortalRequestRow> {
    const row = await prisma.socialPortalRequest.create({
      data: {
        organizationId: session.organizationId,
        customerId: session.customerId,
        approverId: session.approverId,
        type: body.type,
        title: body.title,
        detail: body.detail?.trim() ? body.detail.trim() : null,
        status: 'open',
      },
      select: {
        id: true,
        type: true,
        title: true,
        detail: true,
        status: true,
        reply: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return mapRow(row);
  },

  async listForAgency(organizationId: string, customerId: string): Promise<PortalRequestRow[]> {
    const customer = await prisma.socialCustomer.findFirst({
      where: { id: customerId, organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!customer) throw new HttpError(404, 'Client not found');

    const rows = await prisma.socialPortalRequest.findMany({
      where: { organizationId, customerId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        type: true,
        title: true,
        detail: true,
        status: true,
        reply: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return rows.map(mapRow);
  },

  async updateForAgency(
    organizationId: string,
    customerId: string,
    requestId: string,
    body: UpdatePortalRequestBody
  ): Promise<PortalRequestRow> {
    const existing = await prisma.socialPortalRequest.findFirst({
      where: { id: requestId, organizationId, customerId },
      select: { id: true },
    });
    if (!existing) throw new HttpError(404, 'Request not found');

    const row = await prisma.socialPortalRequest.update({
      where: { id: requestId },
      data: {
        ...(body.status ? { status: body.status } : {}),
        ...(body.reply !== undefined ? { reply: body.reply } : {}),
      },
      select: {
        id: true,
        type: true,
        title: true,
        detail: true,
        status: true,
        reply: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return mapRow(row);
  },
};
