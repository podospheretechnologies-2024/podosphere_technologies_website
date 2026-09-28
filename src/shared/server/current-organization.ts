import 'server-only';
import { cache } from 'react';
import type { Organization } from '@/generated/prisma/client';
import { DEFAULT_ORGANIZATION } from '@/shared/config/organization';
import { prisma } from '@/shared/lib/prisma';

// Until authentication exists every request belongs to the default organization.
// When login is added, resolve the organization from the session here instead.
export const getCurrentOrganization = cache(async (): Promise<Organization> => {
  return prisma.organization.upsert({
    where: { slug: DEFAULT_ORGANIZATION.slug },
    update: {},
    create: { name: DEFAULT_ORGANIZATION.name, slug: DEFAULT_ORGANIZATION.slug },
  });
});
