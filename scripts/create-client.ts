import { PrismaClient } from '../src/generated/prisma/client';
import { approvalService } from '../src/modules/social/server/approvals/approval.service';

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];
  const customerName = process.argv[3] || 'New Client';
  
  if (!email) {
    console.error('Usage: tsx scripts/create-client.ts <approver-email> [client-name]');
    process.exit(1);
  }

  // Get the first organization (assuming agency owner)
  const org = await prisma.organization.findFirst();
  if (!org) throw new Error('No organization found');

  // Create the customer
  const customer = await prisma.socialCustomer.create({
    data: {
      organizationId: org.id,
      name: customerName,
    }
  });
  console.log(`✅ Created Client ID: ${customer.id}`);

  // Generate Magic Link
  console.log(`Generating Magic Link for ${email}...`);
  const link = await approvalService.createMagicLink(customer.id, email, customerName);
  
  console.log(`\n🎉 Success! Send this link to your client:`);
  console.log(link);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
