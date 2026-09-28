import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { DEFAULT_ORGANIZATION } from '../src/shared/config/organization';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
  const organization = await prisma.organization.upsert({
    where: { slug: DEFAULT_ORGANIZATION.slug },
    update: {},
    create: { name: DEFAULT_ORGANIZATION.name, slug: DEFAULT_ORGANIZATION.slug },
  });

  console.log(`Seeded organization "${organization.name}" (${organization.id})`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
