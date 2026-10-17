import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '@/shared/lib/prisma';
import { adsService } from '@/modules/social/server/ads/ads.service';
import { brandKitService } from '@/modules/social/server/ai/brand-kit.service';
import { autopostRepository } from '@/modules/social/server/autoposts/autopost.repository';
import { inboxService } from '@/modules/social/server/inbox/inbox.service';
import { mediaRepository } from '@/modules/social/server/media/media.repository';
import { reportService } from '@/modules/social/server/reports/report.service';
import { integrationRepository } from '@/modules/social/server/integrations/integration.repository';
import { postRepository } from '@/modules/social/server/posts/post.repository';
import { setRepository } from '@/modules/social/server/sets/set.repository';
import { signatureRepository } from '@/modules/social/server/signatures/signature.repository';
import { tagRepository } from '@/modules/social/server/tags/tag.repository';
import { whatsappChatRepository } from '@/modules/social/server/whatsapp/whatsapp-chat.repository';
import { whatsappOnboardingService } from '@/modules/social/server/whatsapp/whatsapp-growth.service';
import type { ClientScope } from './client-scope';

vi.mock('server-only', () => ({}));
vi.mock('./access', () => ({ getAccess: vi.fn() }));
vi.mock('@/modules/social/server/ai/claude.client', () => ({ isClaudeConfigured: vi.fn(), askClaude: vi.fn() }));
vi.mock('@/modules/social/server/billing/plan.service', () => ({ planService: {} }));
vi.mock('@/shared/lib/env', () => ({
  getServerEnv: () => ({ META_SYSTEM_USER_TOKEN: '', META_GRAPH_VERSION: 'v21.0', META_APP_SECRET: '' }),
}));
vi.mock('@/shared/lib/prisma', () => {
  const model = () => ({
    findMany: vi.fn().mockResolvedValue([]),
    findFirst: vi.fn().mockResolvedValue(null),
    count: vi.fn().mockResolvedValue(0),
    update: vi.fn().mockResolvedValue({}),
  });
  return {
    prisma: {
      socialInboxThread: model(),
      socialLead: model(),
      socialClientReport: model(),
      socialIntegration: model(),
      socialPost: model(),
      socialMedia: model(),
      socialBrandKit: model(),
      socialTag: model(),
      socialSignature: model(),
      socialSet: model(),
      socialAutoPost: model(),
      whatsAppConversation: model(),
      socialWhatsAppConnection: model(),
      whatsAppBroadcast: model(),
      adAccount: model(),
      user: model(),
      $transaction: vi.fn().mockResolvedValue([0, []]),
    },
  };
});

// "Client A never sees client B" at the query level: every list must send the scope to the database.
const memberOfA: ClientScope = { organizationId: 'org-1', customerIds: ['client-a'] };
const owner: ClientScope = { organizationId: 'org-1', customerIds: 'all' };
const noClients: ClientScope = { organizationId: 'org-1', customerIds: [] };

function whereOf(fn: unknown): Record<string, unknown> {
  const calls = (fn as ReturnType<typeof vi.fn>).mock.calls;
  return calls[calls.length - 1][0].where;
}

describe('list queries are limited to the scope', () => {
  beforeEach(() => vi.clearAllMocks());

  it('inbox threads', async () => {
    await inboxService.listThreads(memberOfA);
    expect(whereOf(prisma.socialInboxThread.findMany)).toEqual({ organizationId: 'org-1', customerId: { in: ['client-a'] } });
  });

  it('a single inbox thread cannot be fetched by id across clients', async () => {
    await inboxService.getThread(memberOfA, 'thread-of-client-b');
    expect(whereOf(prisma.socialInboxThread.findFirst)).toEqual({
      id: 'thread-of-client-b',
      organizationId: 'org-1',
      customerId: { in: ['client-a'] },
    });
  });

  it('leads', async () => {
    await inboxService.listLeads(memberOfA);
    expect(whereOf(prisma.socialLead.findMany)).toEqual({ organizationId: 'org-1', customerId: { in: ['client-a'] } });
  });

  it('reports', async () => {
    await reportService.list(memberOfA);
    expect(whereOf(prisma.socialClientReport.findMany)).toEqual({ organizationId: 'org-1', customerId: { in: ['client-a'] } });
  });

  it('channels', async () => {
    await integrationRepository.list(memberOfA);
    expect(whereOf(prisma.socialIntegration.findMany)).toEqual({
      organizationId: 'org-1',
      customerId: { in: ['client-a'] },
      deletedAt: null,
    });
  });

  it('posts (list and calendar) are filtered through their channel', async () => {
    await postRepository.list(memberOfA, 1, 'all');
    expect(whereOf(prisma.socialPost.count)).toMatchObject({
      organizationId: 'org-1',
      integration: { customerId: { in: ['client-a'] } },
    });
    await postRepository.listRange(memberOfA, new Date(0), new Date(1));
    expect(whereOf(prisma.socialPost.findMany)).toMatchObject({
      organizationId: 'org-1',
      integration: { customerId: { in: ['client-a'] } },
    });
  });

  it('a single post group cannot be fetched across clients', async () => {
    await postRepository.findGroup(memberOfA, 'group-of-client-b');
    expect(whereOf(prisma.socialPost.findMany)).toEqual({
      organizationId: 'org-1',
      customerId: { in: ['client-a'] },
      group: 'group-of-client-b',
      deletedAt: null,
    });
  });

  it('a member with no clients matches nothing', async () => {
    await inboxService.listLeads(noClients);
    expect(whereOf(prisma.socialLead.findMany)).toEqual({ organizationId: 'org-1', customerId: { in: [] } });
  });

  it('OWNER/ADMIN with "all" is limited to the organization only', async () => {
    await inboxService.listThreads(owner);
    expect(whereOf(prisma.socialInboxThread.findMany)).toEqual({ organizationId: 'org-1' });
  });

  it('media list and findById', async () => {
    await mediaRepository.list({ scope: memberOfA, page: 1 });
    expect(whereOf(prisma.socialMedia.count)).toMatchObject({
      organizationId: 'org-1',
      customerId: { in: ['client-a'] },
    });
    await mediaRepository.findById(memberOfA, 'media-of-client-b');
    expect(whereOf(prisma.socialMedia.findFirst)).toEqual({
      id: 'media-of-client-b',
      organizationId: 'org-1',
      customerId: { in: ['client-a'] },
      deletedAt: null,
    });
  });

  it('brand kit get', async () => {
    await brandKitService.get(memberOfA);
    expect(whereOf(prisma.socialBrandKit.findFirst)).toEqual({
      organizationId: 'org-1',
      customerId: { in: ['client-a'] },
    });
  });

  it('whatsapp conversations and connection', async () => {
    await whatsappChatRepository.listConversations(memberOfA);
    expect(whereOf(prisma.whatsAppConversation.findMany)).toEqual({
      organizationId: 'org-1',
      customerId: { in: ['client-a'] },
    });
    await whatsappChatRepository.findConversationById(memberOfA, 'wa-of-client-b');
    expect(whereOf(prisma.whatsAppConversation.findFirst)).toEqual({
      id: 'wa-of-client-b',
      organizationId: 'org-1',
      customerId: { in: ['client-a'] },
    });
    await whatsappOnboardingService.connection(memberOfA);
    expect(whereOf(prisma.socialWhatsAppConnection.findFirst)).toEqual({
      organizationId: 'org-1',
      customerId: { in: ['client-a'] },
    });
  });

  it('ad accounts list is limited to the client scope', async () => {
    await adsService.listAccounts(memberOfA);
    expect(whereOf(prisma.adAccount.findMany)).toEqual({
      organizationId: 'org-1',
      customerId: { in: ['client-a'] },
    });
  });

  it('OWNER/ADMIN ads list is organization-only (no me/adaccounts)', async () => {
    await adsService.listAccounts(owner);
    expect(whereOf(prisma.adAccount.findMany)).toEqual({ organizationId: 'org-1' });
  });

  it('audiences refuse an ad account outside the scope', async () => {
    await expect(adsService.audiences(memberOfA, 'act_client_b')).rejects.toMatchObject({
      status: 404,
    });
    expect(whereOf(prisma.adAccount.findMany)).toEqual({
      organizationId: 'org-1',
      customerId: { in: ['client-a'] },
    });
  });

  it('catalogs refuse an ad account outside the scope', async () => {
    await expect(adsService.catalogs(memberOfA, 'act_client_b')).rejects.toMatchObject({
      status: 404,
    });
  });

  it('tags', async () => {
    await tagRepository.list(memberOfA);
    expect(whereOf(prisma.socialTag.findMany)).toEqual({
      organizationId: 'org-1',
      customerId: { in: ['client-a'] },
      deletedAt: null,
    });
  });

  it('signatures', async () => {
    await signatureRepository.list(memberOfA);
    expect(whereOf(prisma.socialSignature.findMany)).toEqual({
      organizationId: 'org-1',
      customerId: { in: ['client-a'] },
      deletedAt: null,
    });
  });

  it('sets (templates)', async () => {
    await setRepository.list(memberOfA);
    expect(whereOf(prisma.socialSet.findMany)).toEqual({
      organizationId: 'org-1',
      customerId: { in: ['client-a'] },
    });
  });

  it('autoposts', async () => {
    await autopostRepository.list(memberOfA);
    expect(whereOf(prisma.socialAutoPost.findMany)).toEqual({
      organizationId: 'org-1',
      customerId: { in: ['client-a'] },
      deletedAt: null,
    });
  });
});
