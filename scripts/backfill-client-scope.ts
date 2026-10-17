/**
 * Step 2 of client-wise data (PODO_SOCIAL_CLIENT_PLAN.md 4.2): gives every organization a default
 * "Agency" client and fills `customerId` on existing rows.
 *
 *   pnpm db:backfill-clients            # dry run: prints what would change, writes nothing
 *   pnpm db:backfill-clients --apply    # writes the changes
 *
 * Safe to re-run: only rows with `customerId = NULL` are touched, and the Agency client is created once.
 * Posts get their client from their channel. Autoposts/sets inherit when every linked channel shares
 * one client. Media, inbox, leads, reports, tags, signatures and WhatsApp stay NULL
 * (= the agency's own data) until their features are switched over.
 * (CLI script: builds its own Prisma client because src/shared/lib/prisma.ts is server-only.)
 */
import 'dotenv/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../src/generated/prisma/client';
import { mysqlDriverUrl } from '../src/shared/lib/mysql-url';

const apply = process.argv.includes('--apply');
const AGENCY_CLIENT_NAME = 'Agency';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');
const prisma = new PrismaClient({ adapter: new PrismaMariaDb(mysqlDriverUrl(url)) });

function integrationIdsFromJson(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];
}

/** Shared customerId when every listed channel belongs to the same client; otherwise null (agency-shared). */
async function sharedCustomerId(
  organizationId: string,
  integrationIds: string[]
): Promise<string | null> {
  if (integrationIds.length === 0) return null;
  const channels = await prisma.socialIntegration.findMany({
    where: { id: { in: integrationIds }, organizationId, deletedAt: null },
    select: { customerId: true },
  });
  if (channels.length === 0) return null;
  const ids = new Set(channels.map((c) => c.customerId).filter((id): id is string => id != null));
  return ids.size === 1 ? [...ids][0] : null;
}

async function main() {
  console.log(apply ? 'APPLY mode: writing changes' : 'DRY RUN: nothing is written (use --apply)');

  const organizations = await prisma.organization.findMany({ select: { id: true, name: true } });
  for (const org of organizations) {
    const unlinkedChannels = await prisma.socialIntegration.count({ where: { organizationId: org.id, customerId: null } });
    const unlinkedAdAccounts = await prisma.adAccount.count({ where: { organizationId: org.id, customerId: null } });

    let agency = await prisma.socialCustomer.findFirst({
      where: { organizationId: org.id, name: AGENCY_CLIENT_NAME, deletedAt: null },
    });
    const needsAgency = unlinkedChannels + unlinkedAdAccounts > 0;
    if (!agency && needsAgency) {
      console.log(`[${org.name}] create client "${AGENCY_CLIENT_NAME}"`);
      if (apply) {
        agency = await prisma.socialCustomer.create({ data: { organizationId: org.id, name: AGENCY_CLIENT_NAME } });
      }
    }
    console.log(`[${org.name}] channels without client: ${unlinkedChannels}, ad accounts without client: ${unlinkedAdAccounts}`);

    if (apply && agency) {
      await prisma.socialIntegration.updateMany({
        where: { organizationId: org.id, customerId: null },
        data: { customerId: agency.id },
      });
      await prisma.adAccount.updateMany({
        where: { organizationId: org.id, customerId: null },
        data: { customerId: agency.id },
      });
    }
  }

  // Posts inherit the client of their channel. Done per client so it stays one UPDATE per client.
  const clients = await prisma.socialCustomer.findMany({ select: { id: true, name: true } });
  for (const client of clients) {
    const where = { customerId: null, integration: { customerId: client.id } };
    const count = await prisma.socialPost.count({ where });
    if (count === 0) continue;
    console.log(`[client ${client.name}] posts to link: ${count}`);
    if (apply) await prisma.socialPost.updateMany({ where, data: { customerId: client.id } });
  }

  // Autoposts: link when every selected channel shares one customerId; otherwise leave null (agency-shared).
  const autoposts = await prisma.socialAutoPost.findMany({
    where: { customerId: null, deletedAt: null },
    select: { id: true, organizationId: true, integrationIds: true, title: true },
  });
  let autopostLinked = 0;
  for (const row of autoposts) {
    const customerId = await sharedCustomerId(
      row.organizationId,
      integrationIdsFromJson(row.integrationIds)
    );
    if (!customerId) continue;
    autopostLinked += 1;
    console.log(`[autopost ${row.title}] link to client ${customerId}`);
    if (apply) {
      await prisma.socialAutoPost.update({ where: { id: row.id }, data: { customerId } });
    }
  }
  console.log(`autoposts linked from channels: ${autopostLinked} (of ${autoposts.length} unlinked)`);

  // Sets: same rule from content.integrationIds; tags/signatures stay null (agency-shared).
  const sets = await prisma.socialSet.findMany({
    where: { customerId: null },
    select: { id: true, organizationId: true, content: true, name: true },
  });
  let setsLinked = 0;
  for (const row of sets) {
    const content = (row.content ?? {}) as { integrationIds?: unknown };
    const customerId = await sharedCustomerId(
      row.organizationId,
      integrationIdsFromJson(content.integrationIds)
    );
    if (!customerId) continue;
    setsLinked += 1;
    console.log(`[set ${row.name}] link to client ${customerId}`);
    if (apply) {
      await prisma.socialSet.update({ where: { id: row.id }, data: { customerId } });
    }
  }
  console.log(`sets linked from channels: ${setsLinked} (of ${sets.length} unlinked)`);
  console.log('tags/signatures left null (agency-shared) unless created under a client later');

  console.log('Done.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
