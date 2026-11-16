/**
 * Save the agency's own WhatsApp number as a connected number in the dashboard, using the
 * credentials already in .env (WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_WABA_ID).
 *
 * Embedded Signup cannot do this: Meta does not offer a number to the app owned by the same
 * business, so the popup never lists it. Client numbers still go through Embedded Signup.
 *
 *   pnpm exec tsx scripts/connect-own-whatsapp.ts                         list workspaces + clients
 *   pnpm exec tsx scripts/connect-own-whatsapp.ts --org <id|slug> --client <id|name>
 *   pnpm exec tsx scripts/connect-own-whatsapp.ts --org <id|slug> --workspace
 *   ... add --apply to save. Without it nothing is written.
 *
 * --client     show the number only when that client is selected (recommended)
 * --workspace  show it for the whole workspace ("All clients")
 */
import 'dotenv/config';
import { createCipheriv, createHash, randomBytes } from 'node:crypto';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../src/generated/prisma/client';
import { mysqlDriverUrl } from '../src/shared/lib/mysql-url';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const flag = (name: string) => process.argv.includes(`--${name}`);

const orgArg = arg('org');
const clientArg = arg('client');
const wholeWorkspace = flag('workspace');
const apply = flag('apply');

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');
const prisma = new PrismaClient({ adapter: new PrismaMariaDb(mysqlDriverUrl(url)) });

// Same format as src/shared/lib/crypto.ts (that file is server-only, so it cannot be imported here).
function encrypt(plainText: string): string {
  const secret = process.env.ENCRYPTION_KEY;
  if (!secret || secret.length < 32) throw new Error('ENCRYPTION_KEY is not set');
  const key = createHash('sha256').update(secret).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  return ['v1', iv, cipher.getAuthTag(), encrypted]
    .map((part) => (typeof part === 'string' ? part : part.toString('base64url')))
    .join('.');
}

async function listChoices() {
  const orgs = await prisma.organization.findMany({
    where: { deletedAt: null },
    select: { id: true, slug: true, name: true },
    orderBy: { name: 'asc' },
  });
  for (const org of orgs) {
    console.log(`\nWorkspace "${org.name}"   --org ${org.slug}`);
    const clients = await prisma.socialCustomer.findMany({
      where: { organizationId: org.id },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    for (const client of clients) console.log(`   client "${client.name}"   --client ${client.id}`);
    if (clients.length === 0) console.log('   (no clients)');
  }
  console.log('\nRun again with --org and either --client or --workspace.');
}

async function main() {
  if (!orgArg) return listChoices();
  if (Boolean(clientArg) === wholeWorkspace) {
    throw new Error('Pass exactly one of --client <id|name> or --workspace');
  }

  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const wabaId = process.env.WHATSAPP_WABA_ID;
  if (!token || !phoneNumberId || !wabaId) {
    throw new Error('Set WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_WABA_ID in .env first');
  }

  const org = await prisma.organization.findFirst({
    where: { OR: [{ id: orgArg }, { slug: orgArg }], deletedAt: null },
  });
  if (!org) throw new Error(`No active workspace with id or slug "${orgArg}"`);

  let client: { id: string; name: string } | null = null;
  if (clientArg) {
    const matches = await prisma.socialCustomer.findMany({
      where: { organizationId: org.id, OR: [{ id: clientArg }, { name: { contains: clientArg } }] },
      select: { id: true, name: true },
    });
    if (matches.length !== 1) {
      throw new Error(
        matches.length === 0
          ? `No client matching "${clientArg}" in "${org.name}"`
          : `"${clientArg}" matches ${matches.length} clients (${matches.map((m) => m.name).join(', ')}). Use the client id.`
      );
    }
    client = matches[0];
  }

  // Read-only check that the token really works for this number before saving anything.
  const version = process.env.META_GRAPH_VERSION || 'v26.0';
  const response = await fetch(
    `https://graph.facebook.com/${version}/${phoneNumberId}?fields=display_phone_number,verified_name`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const info = (await response.json().catch(() => ({}))) as {
    display_phone_number?: string;
    verified_name?: string;
    error?: { message?: string };
  };
  if (!response.ok || !info.display_phone_number) {
    throw new Error(`Meta rejected the saved token for this number: ${info.error?.message ?? response.status}`);
  }

  const existing = await prisma.socialWhatsAppConnection.findUnique({ where: { phoneNumberId } });

  console.log(apply ? '=== APPLYING ===' : '=== DRY RUN (add --apply to save) ===');
  console.log(`Number:     ${info.display_phone_number} (${info.verified_name ?? 'no display name'})`);
  console.log(`            phone id ${phoneNumberId}, WhatsApp account ${wabaId}`);
  console.log(`Workspace:  "${org.name}" (${org.slug})`);
  console.log(`Shown for:  ${client ? `client "${client.name}" only` : 'the whole workspace (All clients)'}`);
  console.log(
    existing
      ? `Already saved (workspace ${existing.organizationId}, client ${existing.customerId ?? 'none'}) → will be updated`
      : 'Not saved yet → will be created'
  );
  if (!apply) return;

  const data = {
    organizationId: org.id,
    customerId: client?.id ?? null,
    wabaId,
    displayPhone: info.display_phone_number,
    businessName: info.verified_name ?? null,
    accessToken: encrypt(token),
  };
  await prisma.socialWhatsAppConnection.upsert({
    where: { phoneNumberId },
    create: { ...data, phoneNumberId },
    update: data,
  });
  console.log('Done. Reload the WhatsApp page in the dashboard.');
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
