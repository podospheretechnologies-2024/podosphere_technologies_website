import 'server-only';
import { prisma } from '@/shared/lib/prisma';
import type { Prisma } from '@/generated/prisma/client';

export interface GoogleSheetsConnectionData {
  email: string;
  name?: string | null;
  picture?: string | null;
  accessToken: string;
  refreshToken?: string | null;
  tokenExpiration?: Date | null;
  scopes: string;
  lastSyncedAt?: Date | null;
}

export interface GoogleSpreadsheetData {
  spreadsheetId: string;
  name: string;
  url: string;
  modifiedTime?: Date | null;
  sheetNames: string[];
  headers: string[];
  rows: Prisma.InputJsonValue;
  rowCount: number;
  syncedAt: Date;
}

export const googleSheetsRepository = {
  findConnection(organizationId: string) {
    return prisma.socialGoogleSheetsConnection.findUnique({
      where: { organizationId },
      include: {
        spreadsheets: { orderBy: { name: 'asc' } },
      },
    });
  },

  findConnectionOnly(organizationId: string) {
    return prisma.socialGoogleSheetsConnection.findUnique({
      where: { organizationId },
    });
  },

  upsertConnection(organizationId: string, data: GoogleSheetsConnectionData) {
    return prisma.socialGoogleSheetsConnection.upsert({
      where: { organizationId },
      create: { organizationId, ...data },
      update: { ...data },
    });
  },

  updateTokens(
    organizationId: string,
    tokens: {
      accessToken: string;
      refreshToken?: string | null;
      tokenExpiration?: Date | null;
    }
  ) {
    return prisma.socialGoogleSheetsConnection.update({
      where: { organizationId },
      data: tokens,
    });
  },

  setLastSyncedAt(organizationId: string, lastSyncedAt: Date) {
    return prisma.socialGoogleSheetsConnection.update({
      where: { organizationId },
      data: { lastSyncedAt },
    });
  },

  deleteConnection(organizationId: string) {
    return prisma.socialGoogleSheetsConnection.deleteMany({
      where: { organizationId },
    });
  },

  async replaceSpreadsheets(connectionId: string, items: GoogleSpreadsheetData[]) {
    await prisma.$transaction(async (tx) => {
      await tx.socialGoogleSpreadsheet.deleteMany({ where: { connectionId } });
      if (items.length === 0) return;
      await tx.socialGoogleSpreadsheet.createMany({
        data: items.map((item) => ({
          connectionId,
          spreadsheetId: item.spreadsheetId,
          name: item.name,
          url: item.url,
          modifiedTime: item.modifiedTime ?? null,
          sheetNames: item.sheetNames,
          headers: item.headers,
          rows: item.rows,
          rowCount: item.rowCount,
          syncedAt: item.syncedAt,
        })),
      });
    });
  },

  findSpreadsheet(organizationId: string, id: string) {
    return prisma.socialGoogleSpreadsheet.findFirst({
      where: {
        id,
        connection: { organizationId },
      },
    });
  },
};
