/**
 * Read-only production audit helper (PENDING §3.1 / "audit production users").
 *
 *   pnpm exec tsx scripts/audit-orgs.ts
 *
 * Prints organizations, user counts, roles, and soft-deleted rows. Writes nothing.
 * (CLI script: builds its own Prisma client because src/shared/lib/prisma.ts is server-only.)
 */
import 'dotenv/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../src/generated/prisma/client';
import { mysqlDriverUrl } from '../src/shared/lib/mysql-url';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');
const prisma = new PrismaClient({ adapter: new PrismaMariaDb(mysqlDriverUrl(url)) });

async function main() {
  const organizations = await prisma.organization.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      plan: true,
      createdAt: true,
      deletedAt: true,
      _count: {
        select: {
          users: true,
          socialCustomers: true,
          socialIntegrations: true,
          invitations: true,
        },
      },
      users: {
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isPlatformAdmin: true,
          lastLoginAt: true,
          createdAt: true,
          deletedAt: true,
        },
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  const totalUsers = organizations.reduce((sum, org) => sum + org.users.length, 0);
  const activeOrgs = organizations.filter((org) => !org.deletedAt);
  const softDeletedOrgs = organizations.filter((org) => org.deletedAt);

  console.log('=== Organization / user audit (read-only) ===');
  console.log(`Organizations: ${organizations.length} total (${activeOrgs.length} active, ${softDeletedOrgs.length} soft-deleted)`);
  console.log(`Users (all orgs, including soft-deleted): ${totalUsers}`);
  console.log('');

  for (const org of organizations) {
    const flag = org.deletedAt ? ' [DELETED]' : '';
    console.log(`── ${org.name} (${org.slug})${flag}`);
    console.log(`   id=${org.id} status=${org.status} plan=${org.plan} created=${org.createdAt.toISOString()}`);
    console.log(
      `   counts: users=${org._count.users} clients=${org._count.socialCustomers} channels=${org._count.socialIntegrations} invitations=${org._count.invitations}`
    );
    if (org.users.length === 0) {
      console.log('   users: (none)');
      continue;
    }
    for (const user of org.users) {
      const bits = [
        user.role,
        user.isPlatformAdmin ? 'platform-admin' : null,
        user.deletedAt ? 'deleted' : null,
        user.lastLoginAt ? `lastLogin=${user.lastLoginAt.toISOString()}` : 'never-logged-in',
      ].filter(Boolean);
      console.log(`   - ${user.email} (${user.name}) [${bits.join(', ')}]`);
    }
  }

  console.log('');
  console.log('Done. No changes were written.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
