/**
 * Move one login into another workspace (organization), e.g. fold the empty
 * admin@podospheretechnologies.com workspace into the main PodoSphere workspace.
 *
 *   pnpm exec tsx scripts/move-user-to-workspace.ts --email admin@x.com --to <org id or slug>
 *   pnpm exec tsx scripts/move-user-to-workspace.ts --email admin@x.com --to <org id or slug> --apply
 *
 * Options
 *   --role ADMIN|MEMBER   role in the new workspace (default ADMIN; OWNER is never handed out)
 *   --plan agency_pro     also set the target workspace's plan + limits (e.g. to allow 60 clients)
 *   --keep-old            do not hide the old workspace even if it is left with no logins
 *
 * Without --apply it only prints what would change. Get org ids/slugs from `pnpm db:audit-orgs`.
 * The moved person is logged out (their session names the old workspace) and logs in again.
 */
import 'dotenv/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../src/generated/prisma/client';
import { mysqlDriverUrl } from '../src/shared/lib/mysql-url';
import { PLANS, isPlanKey } from '../src/modules/social/config/plans';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const flag = (name: string) => process.argv.includes(`--${name}`);

const email = arg('email')?.toLowerCase();
const to = arg('to');
const role = (arg('role') ?? 'ADMIN').toUpperCase();
const planArg = arg('plan');
const apply = flag('apply');
const keepOld = flag('keep-old');

if (!email || !to) {
  console.error('Usage: tsx scripts/move-user-to-workspace.ts --email <login> --to <org id or slug> [--role ADMIN] [--plan agency_pro] [--apply]');
  process.exit(1);
}
if (role !== 'ADMIN' && role !== 'MEMBER') {
  console.error('--role must be ADMIN or MEMBER');
  process.exit(1);
}
if (planArg && !isPlanKey(planArg)) {
  console.error(`--plan must be one of: ${Object.keys(PLANS).join(', ')}`);
  process.exit(1);
}

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');
const prisma = new PrismaClient({ adapter: new PrismaMariaDb(mysqlDriverUrl(url)) });

async function main() {
  const user = await prisma.user.findUnique({ where: { email }, include: { organization: true } });
  if (!user || user.deletedAt) throw new Error(`No active login with email ${email}`);

  const target = await prisma.organization.findFirst({
    where: { OR: [{ id: to }, { slug: to }], deletedAt: null },
  });
  if (!target) throw new Error(`No active workspace with id or slug "${to}"`);
  if (target.id === user.organizationId) {
    console.log(`${email} is already in "${target.name}". Nothing to do.`);
    return;
  }

  const source = user.organization;
  const [otherLogins, sourceCounts, targetCounts] = await Promise.all([
    prisma.user.count({ where: { organizationId: source.id, deletedAt: null, id: { not: user.id } } }),
    prisma.organization.findUniqueOrThrow({
      where: { id: source.id },
      select: { _count: { select: { socialCustomers: true, socialIntegrations: true } } },
    }),
    prisma.organization.findUniqueOrThrow({
      where: { id: target.id },
      select: { _count: { select: { users: true, socialCustomers: true, socialIntegrations: true } } },
    }),
  ]);
  const hideOld = otherLogins === 0 && !keepOld;

  console.log(apply ? '=== APPLYING ===' : '=== DRY RUN (add --apply to make these changes) ===');
  console.log(`Login:      ${user.email} (${user.name}), now ${user.role} in "${source.name}" (${source.slug})`);
  console.log(`Move to:    "${target.name}" (${target.slug}) as ${role}`);
  console.log(`            target has ${targetCounts._count.users} logins, ${targetCounts._count.socialCustomers} clients, ${targetCounts._count.socialIntegrations} channels`);
  console.log(`Old space:  ${sourceCounts._count.socialCustomers} clients, ${sourceCounts._count.socialIntegrations} channels, ${otherLogins} other logins`);
  console.log(
    hideOld
      ? '            → hidden (soft-deleted) because no login is left in it. Its data stays in the database.'
      : '            → kept' + (otherLogins > 0 ? ' (other logins still use it)' : ' (--keep-old)')
  );
  if (user.isPlatformAdmin) console.log('Platform admin flag stays on.');
  if (planArg && isPlanKey(planArg)) {
    const p = PLANS[planArg];
    console.log(`Target plan: ${target.plan} → ${p.key} (clients ${p.maxClients}, users ${p.maxUsers}, channels ${p.maxChannels})`);
  }

  if (!apply) return;

  await prisma.$transaction(async (tx) => {
    // Client access rows point at the old workspace's clients; they mean nothing in the new one.
    await tx.socialClientMember.deleteMany({ where: { userId: user.id } });
    await tx.user.update({
      where: { id: user.id },
      data: { organizationId: target.id, role: role as 'ADMIN' | 'MEMBER' },
    });
    if (hideOld) {
      await tx.organization.update({ where: { id: source.id }, data: { deletedAt: new Date() } });
    }
    if (planArg && isPlanKey(planArg)) {
      const p = PLANS[planArg];
      await tx.organization.update({
        where: { id: target.id },
        data: { plan: p.key, maxClients: p.maxClients, maxUsers: p.maxUsers, maxChannels: p.maxChannels },
      });
    }
  });
  console.log('Done. The moved login must log in again.');
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
