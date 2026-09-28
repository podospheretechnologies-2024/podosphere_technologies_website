import 'dotenv/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '../src/generated/prisma/client';
import { DEFAULT_ORGANIZATION } from '../src/shared/config/organization';
import { mysqlDriverUrl } from '../src/shared/lib/mysql-url';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

const prisma = new PrismaClient({ adapter: new PrismaMariaDb(mysqlDriverUrl(connectionString)) });

async function main() {
  const organization = await prisma.organization.upsert({
    where: { slug: DEFAULT_ORGANIZATION.slug },
    update: {},
    create: { name: DEFAULT_ORGANIZATION.name, slug: DEFAULT_ORGANIZATION.slug },
  });
  console.log(`Seeded organization "${organization.name}" (${organization.id})`);

  // First login (dev only). Credentials come from .env, never from code.
  const email = process.env.SEED_ADMIN_EMAIL?.toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) {
    console.log('SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD not set: no login created.');
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Login ${email} already exists. Nothing changed.`);
    return;
  }

  await prisma.user.create({
    data: {
      organizationId: organization.id,
      name: 'PodoSphere Admin',
      email,
      passwordHash: await bcrypt.hash(password, 12),
      role: 'OWNER',
    },
  });
  console.log(`Created owner login ${email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
