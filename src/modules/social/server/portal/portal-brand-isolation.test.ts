import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('../ai/brand-kit.service', () => ({
  brandKitSchema: { parse: (value: unknown) => value },
  brandKitService: {
    get: vi.fn().mockResolvedValue({ brand_name: 'Acme' }),
    save: vi.fn().mockResolvedValue({ brand_name: 'Acme' }),
  },
}));
vi.mock('../media/media.service', () => ({
  mediaService: {
    list: vi.fn().mockResolvedValue({ results: [] }),
    upload: vi.fn(),
  },
}));
vi.mock('@/shared/lib/prisma', () => ({
  prisma: {
    socialCustomer: {
      findFirst: vi.fn().mockResolvedValue({ id: 'client-a' }),
    },
  },
}));

import { brandKitService } from '../ai/brand-kit.service';
import { mediaService } from '../media/media.service';
import { portalBrandService } from './portal-brand.service';

describe('portal brand tenant isolation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reads brand kit + media with a single-client scope', async () => {
    await portalBrandService.get({ organizationId: 'org-a', customerId: 'client-a' });
    expect(brandKitService.get).toHaveBeenCalledWith({
      organizationId: 'org-a',
      customerIds: ['client-a'],
    });
    expect(mediaService.list).toHaveBeenCalledWith(
      { organizationId: 'org-a', customerIds: ['client-a'] },
      { page: 1 }
    );
  });

  it('saves brand kit only through the session client scope', async () => {
    await portalBrandService.save(
      { organizationId: 'org-a', customerId: 'client-a' },
      { brand_name: 'Acme' }
    );
    expect(brandKitService.save).toHaveBeenCalledWith(
      { organizationId: 'org-a', customerIds: ['client-a'] },
      expect.objectContaining({ brand_name: 'Acme' })
    );
  });
});
