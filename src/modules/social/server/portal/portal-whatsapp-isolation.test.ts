import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/shared/server/audit.service', () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../whatsapp/order-flow.service', () => ({
  orderFlowService: {
    results: vi.fn().mockResolvedValue({
      messagesSent: 0,
      cartsRecovered: 0,
      revenueRecovered: 0,
      moneySpentEstimate: 0,
    }),
  },
}));
vi.mock('../whatsapp/lead-whatsapp.service', () => ({
  leadWhatsAppService: {
    getFlow: vi.fn().mockResolvedValue({
      enabled: true,
      welcomeTemplate: 'welcome_tpl',
      welcomeLanguage: 'en',
      followUp1Template: 'follow_1',
      followUp1Language: 'en',
      followUp1AfterHours: 24,
      followUp2Template: null,
      followUp2Language: null,
      followUp2AfterHours: 48,
      alertPhone: 'secret-alert-phone',
      alertTemplate: 'alert_tpl',
      alertLanguage: 'en',
    }),
  },
}));
vi.mock('./portal-plugs.service', () => ({
  portalPlugsService: {
    list: vi.fn().mockResolvedValue({
      autoReplies: [
        {
          id: 'ar-1',
          name: 'Hours',
          matchType: 'keyword',
          pattern: 'hours',
          caseSensitive: false,
          replyType: 'text',
          replyText: 'We are open 10-6',
          templateName: null,
          templateLanguage: null,
          businessHoursEnabled: false,
          businessHoursStart: null,
          businessHoursEnd: null,
          businessHoursTimezone: null,
          priority: 1,
          active: true,
        },
      ],
      autoPosts: [],
    }),
  },
}));
vi.mock('../whatsapp/whatsapp-growth.service', () => ({
  whatsappOnboardingService: {
    messageStats: vi.fn().mockResolvedValue({
      status: 'OK',
      days: 30,
      sent: 12,
      delivered: 10,
    }),
  },
  broadcastService: {
    list: vi.fn().mockResolvedValue([]),
    createPending: vi.fn(),
    send: vi.fn(),
  },
}));
vi.mock('../whatsapp/whatsapp.service', () => ({
  whatsappService: {
    overview: vi.fn().mockResolvedValue({
      configured: true,
      number: {
        id: 'secret-phone-number-id',
        displayPhoneNumber: '+91 98765 43210',
        verifiedName: 'Client Brand',
        status: 'CONNECTED',
        qualityRating: 'GREEN',
        messagingLimitTier: 'TIER_1K',
      },
      templates: [],
      templatesAvailable: true,
    }),
    listConversations: vi.fn().mockResolvedValue([]),
    getConversation: vi.fn(),
    templates: vi.fn().mockResolvedValue([]),
    send: vi.fn().mockResolvedValue({ messageId: 'wamid.1', waId: '919876543210' }),
  },
}));
vi.mock('@/shared/lib/prisma', () => {
  const model = () => ({
    findMany: vi.fn().mockResolvedValue([]),
    findFirst: vi.fn().mockResolvedValue(null),
    count: vi.fn().mockResolvedValue(0),
    aggregate: vi.fn().mockResolvedValue({ _sum: { sentCount: 0 } }),
  });
  return {
    prisma: {
      socialWhatsAppConnection: model(),
      socialLead: model(),
      whatsAppBroadcast: model(),
      whatsAppMessage: model(),
      socialCustomer: model(),
      clientApprover: model(),
    },
  };
});

import { prisma } from '@/shared/lib/prisma';
import { logAudit } from '@/shared/server/audit.service';
import { orderFlowService } from '../whatsapp/order-flow.service';
import { leadWhatsAppService } from '../whatsapp/lead-whatsapp.service';
import {
  broadcastService,
  whatsappOnboardingService,
} from '../whatsapp/whatsapp-growth.service';
import { whatsappService } from '../whatsapp/whatsapp.service';
import { portalPlugsService } from './portal-plugs.service';
import { portalWhatsAppService } from './portal-whatsapp.service';

const ORG = 'org-a';
const CLIENT_A = 'client-a';
const CLIENT_B = 'client-b';

type Mocked = Record<string, Record<string, ReturnType<typeof vi.fn>>>;
const db = prisma as unknown as Mocked;

function whereOf(fn: ReturnType<typeof vi.fn>) {
  return (fn.mock.calls[0]?.[0] as { where: Record<string, unknown> }).where;
}

const sessionA = {
  approverId: 'apr-a',
  organizationId: ORG,
  customerId: CLIENT_A,
  mustChangePassword: false,
};

const scopeA = { organizationId: ORG, customerIds: [CLIENT_A] };

describe('portal WhatsApp tenant isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.socialCustomer.findFirst.mockResolvedValue({ portalTabs: null });
    db.clientApprover.findFirst.mockResolvedValue({ name: 'Alex', email: 'a@example.com' });
    db.whatsAppMessage.count.mockResolvedValue(0);
  });

  it('scopes summary connections, leads and broadcasts to session org + client', async () => {
    db.socialWhatsAppConnection.findFirst.mockResolvedValueOnce({
      displayPhone: '+91 111',
      businessName: 'Brand A',
    });

    const summary = await portalWhatsAppService.summary({
      organizationId: ORG,
      customerId: CLIENT_A,
    });

    expect(whereOf(db.socialWhatsAppConnection.findFirst)).toEqual({
      organizationId: ORG,
      customerId: CLIENT_A,
    });
    expect(whereOf(db.socialLead.count)).toMatchObject({
      organizationId: ORG,
      customerId: CLIENT_A,
    });
    expect(whereOf(db.whatsAppBroadcast.aggregate)).toEqual({
      organizationId: ORG,
      customerId: CLIENT_A,
      status: { in: ['sent', 'partial'] },
    });
    expect(whatsappService.overview).toHaveBeenCalledWith(scopeA);
    expect(whatsappOnboardingService.messageStats).toHaveBeenCalledWith(scopeA, 30);

    // Portal shape: no phone_number_id / Meta id leaked from overview.
    expect(summary.number).toEqual({
      displayPhone: '+91 98765 43210',
      businessName: 'Client Brand',
      qualityRating: 'GREEN',
      messagingLimitTier: 'TIER_1K',
    });
    expect(JSON.stringify(summary)).not.toContain('secret-phone-number-id');
    expect(summary.stats30d).toEqual({ sent: 12, delivered: 10, replied: 0 });
    expect(summary.broadcastNeedsApproval).toBe(true);
    expect(summary.orderFlows?.days).toBe(30);
  });

  it('passes order recovery day range into orderFlowService.results', async () => {
    await portalWhatsAppService.summary(
      { organizationId: ORG, customerId: CLIENT_A },
      { days: 7 }
    );

    expect(orderFlowService.results).toHaveBeenCalledWith(
      scopeA,
      expect.objectContaining({ from: expect.any(String) })
    );
    const filters = (orderFlowService.results as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as {
      from: string;
    };
    const fromMs = new Date(filters.from).getTime();
    const ageDays = (Date.now() - fromMs) / (24 * 60 * 60 * 1000);
    expect(ageDays).toBeGreaterThan(6.5);
    expect(ageDays).toBeLessThan(7.5);
  });

  it('counts 30d replies and today sends only for session client conversations', async () => {
    await portalWhatsAppService.summary({ organizationId: ORG, customerId: CLIENT_A });

    const replyWhere = whereOf(db.whatsAppMessage.count);
    expect(replyWhere).toMatchObject({
      organizationId: ORG,
      direction: 'inbound',
      conversation: { customerId: CLIENT_A },
    });
    expect(replyWhere.conversation).not.toEqual(
      expect.objectContaining({ customerId: CLIENT_B })
    );

    const sendWhere = (
      db.whatsAppMessage.count.mock.calls[1]?.[0] as { where: Record<string, unknown> }
    ).where;
    expect(sendWhere).toMatchObject({
      organizationId: ORG,
      direction: 'outbound',
      conversation: { customerId: CLIENT_A },
    });
  });

  it('lists conversations with forced client scope only', async () => {
    (whatsappService.listConversations as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      {
        id: 'c1',
        waId: '919111',
        contactName: 'Pat',
        lastMessageAt: '2026-11-18T10:00:00.000Z',
        lastInboundAt: '2026-11-18T09:00:00.000Z',
        lastPreview: 'Hi',
        unreadCount: 1,
        withinWindow: true,
        adHeadline: null,
      },
    ]);

    const result = await portalWhatsAppService.listConversations({
      organizationId: ORG,
      customerId: CLIENT_A,
    });

    expect(whatsappService.listConversations).toHaveBeenCalledWith(scopeA);
    expect(result.conversations[0]).toMatchObject({
      id: 'c1',
      contactPhone: '919111',
      contactName: 'Pat',
      withinWindow: true,
    });
    expect(result.conversations[0]).not.toHaveProperty('waId');
    expect(result.conversations[0]).not.toHaveProperty('adSourceId');
  });

  it('loads conversation detail with forced client scope', async () => {
    (whatsappService.getConversation as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      conversation: {
        id: 'c1',
        waId: '919111',
        contactName: 'Pat',
        lastMessageAt: '2026-11-18T10:00:00.000Z',
        lastInboundAt: '2026-11-18T09:00:00.000Z',
        lastPreview: 'Hi',
        unreadCount: 0,
        withinWindow: true,
        adHeadline: null,
      },
      messages: [
        {
          id: 'm1',
          wamid: 'secret-wamid',
          direction: 'inbound',
          type: 'text',
          body: 'Hi',
          status: null,
          source: 'customer',
          senderLabel: null,
          timestamp: '2026-11-18T09:00:00.000Z',
        },
      ],
    });

    const detail = await portalWhatsAppService.getConversation(
      { organizationId: ORG, customerId: CLIENT_A },
      'c1'
    );

    expect(whatsappService.getConversation).toHaveBeenCalledWith(scopeA, 'c1');
    expect(detail.messages[0]).toEqual({
      id: 'm1',
      direction: 'inbound',
      body: 'Hi',
      status: null,
      timestamp: '2026-11-18T09:00:00.000Z',
    });
    expect(JSON.stringify(detail)).not.toContain('secret-wamid');
  });

  it('lists only APPROVED templates and strips Meta template ids', async () => {
    (whatsappService.templates as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      {
        id: 'tpl-secret',
        name: 'hello',
        language: 'en',
        status: 'APPROVED',
        category: 'UTILITY',
        body: 'Hello {{1}}',
        variables: ['1'],
        parameterFormat: 'POSITIONAL',
        headerFormat: null,
        buttonUrlParamCount: 0,
        unsupportedReason: null,
      },
      {
        id: 'tpl-pending',
        name: 'soon',
        language: 'en',
        status: 'PENDING',
        category: 'MARKETING',
        body: 'Soon',
        variables: [],
        parameterFormat: 'POSITIONAL',
        headerFormat: null,
        buttonUrlParamCount: 0,
        unsupportedReason: null,
      },
      {
        id: 'tpl-bad',
        name: 'media',
        language: 'en',
        status: 'APPROVED',
        category: 'MARKETING',
        body: 'Media',
        variables: [],
        parameterFormat: 'POSITIONAL',
        headerFormat: 'IMAGE',
        buttonUrlParamCount: 0,
        unsupportedReason: 'IMAGE header not supported',
      },
    ]);

    const result = await portalWhatsAppService.listTemplates({
      organizationId: ORG,
      customerId: CLIENT_A,
    });

    expect(whatsappService.templates).toHaveBeenCalledWith(scopeA);
    expect(result.templates).toEqual([
      {
        name: 'hello',
        language: 'en',
        category: 'UTILITY',
        bodyPreview: 'Hello {{1}}',
        variablesCount: 1,
        variables: ['1'],
      },
    ]);
    expect(JSON.stringify(result)).not.toContain('tpl-secret');
  });

  it('replies with forced client scope, audits approverId, and never uses another client', async () => {
    (whatsappService.getConversation as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        conversation: {
          id: 'c1',
          waId: '919111',
          contactName: 'Pat',
          lastMessageAt: '2026-11-18T10:00:00.000Z',
          lastInboundAt: '2026-11-18T09:00:00.000Z',
          lastPreview: 'Hi',
          unreadCount: 0,
          withinWindow: true,
          adHeadline: null,
        },
        messages: [],
      })
      .mockResolvedValueOnce({
        conversation: {
          id: 'c1',
          waId: '919111',
          contactName: 'Pat',
          lastMessageAt: '2026-11-18T10:01:00.000Z',
          lastInboundAt: '2026-11-18T09:00:00.000Z',
          lastPreview: 'Thanks',
          unreadCount: 0,
          withinWindow: true,
          adHeadline: null,
        },
        messages: [
          {
            id: 'm-out',
            wamid: 'wamid.1',
            direction: 'outbound',
            type: 'text',
            body: 'Thanks',
            status: 'sent',
            source: 'podosocial',
            senderLabel: 'Alex (PodoSocial)',
            timestamp: '2026-11-18T10:01:00.000Z',
          },
        ],
      });

    await portalWhatsAppService.reply(sessionA, 'c1', 'Thanks');

    expect(whatsappService.send).toHaveBeenCalledWith(
      scopeA,
      { type: 'text', to: '919111', text: 'Thanks' },
      { senderName: 'Alex' }
    );
    const sendScope = (whatsappService.send as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as {
      customerIds: string[];
    };
    expect(sendScope.customerIds).toEqual([CLIENT_A]);
    expect(sendScope.customerIds).not.toContain(CLIENT_B);

    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'portal.whatsapp.reply',
        targetType: 'whatsapp_conversation',
        targetId: 'c1',
        metadata: expect.objectContaining({
          customerId: CLIENT_A,
          approverId: 'apr-a',
        }),
      })
    );
  });

  it('blocks reply outside the 24h window without calling Meta send', async () => {
    (whatsappService.getConversation as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      conversation: {
        id: 'c1',
        waId: '919111',
        contactName: null,
        lastMessageAt: '2026-11-10T10:00:00.000Z',
        lastInboundAt: '2026-11-10T09:00:00.000Z',
        lastPreview: 'Hi',
        unreadCount: 0,
        withinWindow: false,
        adHeadline: null,
      },
      messages: [],
    });

    await expect(portalWhatsAppService.reply(sessionA, 'c1', 'Too late')).rejects.toThrow(
      /24 hours/i
    );
    expect(whatsappService.send).not.toHaveBeenCalled();
  });

  it('sends a template with forced client scope, audits, and enforces daily cap', async () => {
    (whatsappService.templates as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: 'tpl-1',
        name: 'hello',
        language: 'en',
        status: 'APPROVED',
        category: 'UTILITY',
        body: 'Hello {{1}}',
        variables: ['1'],
        parameterFormat: 'POSITIONAL',
        headerFormat: null,
        buttonUrlParamCount: 0,
        unsupportedReason: null,
      },
    ]);

    await portalWhatsAppService.sendTemplate(sessionA, {
      to: '919876543210',
      templateName: 'hello',
      language: 'en',
      variables: ['Pat'],
    });

    expect(whatsappService.send).toHaveBeenCalledWith(
      scopeA,
      {
        type: 'template',
        to: '919876543210',
        templateName: 'hello',
        language: 'en',
        variables: ['Pat'],
      },
      { senderName: 'Alex' }
    );
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'portal.whatsapp.template_send',
        metadata: expect.objectContaining({
          customerId: CLIENT_A,
          approverId: 'apr-a',
          templateName: 'hello',
        }),
      })
    );
  });

  it('rejects act sends when the daily cap is already used', async () => {
    db.whatsAppMessage.count.mockResolvedValue(50);
    db.socialCustomer.findFirst.mockResolvedValue({ portalTabs: null });

    await expect(
      portalWhatsAppService.sendTemplate(sessionA, {
        to: '919876543210',
        templateName: 'hello',
        language: 'en',
        variables: [],
      })
    ).rejects.toThrow(/Daily WhatsApp send limit/i);
    expect(whatsappService.send).not.toHaveBeenCalled();
  });

  it('lists broadcasts only through forced client scope and strips customerId', async () => {
    (broadcastService.list as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      {
        id: 'b1',
        name: 'Diwali',
        templateName: 'offer',
        language: 'en',
        status: 'pending_approval',
        recipientCount: 3,
        sentCount: 0,
        customerId: CLIENT_A,
        consentAt: null,
        estimatedCostPaise: 240,
        createdAt: '2026-11-18T10:00:00.000Z',
      },
    ]);

    const result = await portalWhatsAppService.listBroadcasts({
      organizationId: ORG,
      customerId: CLIENT_A,
    });

    expect(broadcastService.list).toHaveBeenCalledWith(scopeA);
    expect(result.broadcasts[0]).toEqual({
      id: 'b1',
      name: 'Diwali',
      templateName: 'offer',
      language: 'en',
      status: 'pending_approval',
      recipientCount: 3,
      sentCount: 0,
      createdAt: '2026-11-18T10:00:00.000Z',
    });
    expect(result.broadcasts[0]).not.toHaveProperty('customerId');
  });

  it('submits broadcasts for approval without Meta send when flag is true', async () => {
    db.socialCustomer.findFirst.mockResolvedValue({ portalTabs: null });
    (whatsappService.templates as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: 'tpl-1',
        name: 'offer',
        language: 'en',
        status: 'APPROVED',
        category: 'MARKETING',
        body: 'Hi {{1}}',
        variables: ['1'],
        parameterFormat: 'POSITIONAL',
        headerFormat: null,
        buttonUrlParamCount: 0,
        unsupportedReason: null,
      },
    ]);
    (broadcastService.createPending as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: 'b-pending',
      status: 'pending_approval',
      recipientCount: 2,
      skippedOptedOut: 0,
      estimatedCostPaise: 160,
      consentAt: '2026-11-18T10:00:00.000Z',
      needsApproval: true,
    });

    const result = await portalWhatsAppService.createBroadcast(sessionA, {
      name: 'Festive',
      templateName: 'offer',
      language: 'en',
      phones: ['919111111111', '919222222222'],
      variables: ['Friend'],
      consentAcknowledged: true,
    });

    expect(broadcastService.createPending).toHaveBeenCalledWith(
      scopeA,
      expect.objectContaining({
        name: 'Festive',
        templateName: 'offer',
        consentAcknowledged: true,
      })
    );
    expect(broadcastService.send).not.toHaveBeenCalled();
    expect(result.needsApproval).toBe(true);
    expect(result.status).toBe('pending_approval');
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'portal.whatsapp.broadcast_submit',
        metadata: expect.objectContaining({
          customerId: CLIENT_A,
          needsApproval: true,
        }),
      })
    );
  });

  it('sends broadcasts immediately when approval is disabled, still under daily cap', async () => {
    db.socialCustomer.findFirst.mockResolvedValue({
      portalTabs: { whatsappBroadcastNeedsApproval: false, whatsappDailyCap: 50 },
    });
    (whatsappService.templates as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: 'tpl-1',
        name: 'offer',
        language: 'en',
        status: 'APPROVED',
        category: 'MARKETING',
        body: 'Hi',
        variables: [],
        parameterFormat: 'POSITIONAL',
        headerFormat: null,
        buttonUrlParamCount: 0,
        unsupportedReason: null,
      },
    ]);
    (broadcastService.send as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: 'b-sent',
      sent: 2,
      total: 2,
      skippedOptedOut: 0,
      estimatedCostPaise: 160,
      consentAt: '2026-11-18T10:00:00.000Z',
      needsApproval: false,
    });

    const result = await portalWhatsAppService.createBroadcast(sessionA, {
      name: 'Now',
      templateName: 'offer',
      language: 'en',
      phones: ['919111111111', '919222222222'],
      variables: [],
      consentAcknowledged: true,
    });

    expect(broadcastService.createPending).not.toHaveBeenCalled();
    expect(broadcastService.send).toHaveBeenCalledWith(
      scopeA,
      expect.objectContaining({ name: 'Now', templateName: 'offer' })
    );
    expect(result.needsApproval).toBe(false);
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'portal.whatsapp.broadcast_send' })
    );
  });

  it('blocks broadcast when recipient count exceeds remaining daily cap', async () => {
    db.whatsAppMessage.count.mockResolvedValue(49);
    db.socialCustomer.findFirst.mockResolvedValue({ portalTabs: { whatsappDailyCap: 50 } });
    (whatsappService.templates as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: 'tpl-1',
        name: 'offer',
        language: 'en',
        status: 'APPROVED',
        category: 'MARKETING',
        body: 'Hi',
        variables: [],
        parameterFormat: 'POSITIONAL',
        headerFormat: null,
        buttonUrlParamCount: 0,
        unsupportedReason: null,
      },
    ]);

    await expect(
      portalWhatsAppService.createBroadcast(sessionA, {
        name: 'Too many',
        templateName: 'offer',
        language: 'en',
        phones: ['919111111111', '919222222222'],
        variables: [],
        consentAcknowledged: true,
      })
    ).rejects.toThrow(/Only 1 send/i);
    expect(broadcastService.createPending).not.toHaveBeenCalled();
    expect(broadcastService.send).not.toHaveBeenCalled();
  });

  it('returns automation for session client only and strips alert phone', async () => {
    const result = await portalWhatsAppService.automation({
      organizationId: ORG,
      customerId: CLIENT_A,
    });

    expect(portalPlugsService.list).toHaveBeenCalledWith({
      organizationId: ORG,
      customerId: CLIENT_A,
    });
    expect(leadWhatsAppService.getFlow).toHaveBeenCalledWith(scopeA);
    expect(result.autoReplies).toEqual([
      {
        id: 'ar-1',
        name: 'Hours',
        matchType: 'keyword',
        pattern: 'hours',
        replyType: 'text',
        active: true,
      },
    ]);
    expect(result.leadFlow).toEqual({
      enabled: true,
      welcomeTemplate: 'welcome_tpl',
      followUp1Template: 'follow_1',
      followUp2Template: null,
    });
    expect(JSON.stringify(result)).not.toContain('secret-alert-phone');
  });
});
