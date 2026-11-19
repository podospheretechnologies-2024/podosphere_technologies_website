import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const env = {
  WHATSAPP_PHONE_NUMBER_ID: 'env-phone-number-id',
  META_APP_SECRET: 'test-secret',
  META_WEBHOOK_VERIFY_TOKEN: 'verify',
};

vi.mock('@/shared/lib/env', () => ({
  getServerEnv: () => env,
}));

const findUniqueConnection = vi.fn();
const findUniqueMessage = vi.fn();
const findFirstConversation = vi.fn();
const findFirstOrganization = vi.fn();
const updateConversation = vi.fn();

vi.mock('@/shared/lib/prisma', () => ({
  prisma: {
    socialWhatsAppConnection: {
      findUnique: (...args: unknown[]) => findUniqueConnection(...args),
    },
    whatsAppMessage: {
      findUnique: (...args: unknown[]) => findUniqueMessage(...args),
    },
    whatsAppConversation: {
      findFirst: (...args: unknown[]) => findFirstConversation(...args),
      update: (...args: unknown[]) => updateConversation(...args),
    },
    organization: {
      findFirst: (...args: unknown[]) => findFirstOrganization(...args),
    },
  },
}));

const upsertConversation = vi.fn();
const createMessage = vi.fn();
const updateMessageStatus = vi.fn();

vi.mock('./whatsapp-chat.repository', () => ({
  whatsappChatRepository: {
    upsertConversation: (...args: unknown[]) => upsertConversation(...args),
    createMessage: (...args: unknown[]) => createMessage(...args),
    updateMessageStatus: (...args: unknown[]) => updateMessageStatus(...args),
  },
}));

vi.mock('./auto-reply.service', () => ({
  autoReplyService: { maybeReply: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('./lead-whatsapp.service', () => ({
  leadWhatsAppService: {
    onInbound: vi.fn().mockResolvedValue(undefined),
    onAdChat: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('./order-flow.repository', () => ({
  orderFlowRepository: {
    updateMessageStatusByWamid: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../podocrm/podocrm-whatsapp-sync.service', () => ({
  podoCrmWhatsAppSyncService: {
    relayStatus: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('./meta-webhook-signature', () => ({
  verifyMetaHubSignature: vi.fn(),
}));

import { whatsappWebhookService } from './whatsapp-webhook.service';

describe('whatsappWebhookService.ingest phone_number_id gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    env.WHATSAPP_PHONE_NUMBER_ID = 'env-phone-number-id';
    findUniqueMessage.mockResolvedValue(null);
    findFirstConversation.mockResolvedValue(null);
    findFirstOrganization.mockResolvedValue({ id: 'org-fallback' });
    upsertConversation.mockResolvedValue({ id: 'conv-1', adSourceId: null });
    createMessage.mockResolvedValue({ id: 'msg-1' });
    updateMessageStatus.mockResolvedValue({ count: 1 });
  });

  it('stores an inbound message when phone_number_id is not the env id but has a connection row', async () => {
    const embeddedPhoneNumberId = '1198471690026354';
    findUniqueConnection.mockResolvedValue({
      organizationId: 'org-embedded',
      customerId: 'client-1',
    });

    const result = await whatsappWebhookService.ingest({
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'waba-1',
          changes: [
            {
              field: 'messages',
              value: {
                messaging_product: 'whatsapp',
                metadata: {
                  phone_number_id: embeddedPhoneNumberId,
                  display_phone_number: '9119127859',
                },
                contacts: [{ wa_id: '919999000011', profile: { name: 'Customer' } }],
                messages: [
                  {
                    from: '919999000011',
                    id: 'wamid.embedded-inbound-1',
                    timestamp: '1700000000',
                    type: 'text',
                    text: { body: 'Heyyy' },
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    expect(result).toEqual({ stored: 1 });
    expect(findUniqueConnection).toHaveBeenCalledWith({
      where: { phoneNumberId: embeddedPhoneNumberId },
      select: { organizationId: true, customerId: true },
    });
    expect(upsertConversation).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-embedded',
        customerId: 'client-1',
        waId: '919999000011',
        preview: 'Heyyy',
        inbound: true,
      })
    );
    expect(createMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-embedded',
        conversationId: 'conv-1',
        wamid: 'wamid.embedded-inbound-1',
        direction: 'inbound',
        body: 'Heyyy',
        status: 'received',
      })
    );
  });

  it('skips webhooks for an unknown phone_number_id and does not store', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    findUniqueConnection.mockResolvedValue(null);

    const result = await whatsappWebhookService.ingest({
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'waba-1',
          changes: [
            {
              field: 'messages',
              value: {
                metadata: { phone_number_id: 'unknown-phone-id' },
                messages: [
                  {
                    from: '919999000011',
                    id: 'wamid.skip-1',
                    timestamp: '1700000000',
                    type: 'text',
                    text: { body: 'Nope' },
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    expect(result).toEqual({ stored: 0 });
    expect(createMessage).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      '[whatsapp] ignoring webhook for unknown phone_number_id=unknown-phone-id'
    );
    warn.mockRestore();
  });

  it('updates outbound message status to failed when Meta reports a status webhook', async () => {
    findUniqueConnection.mockResolvedValue({
      organizationId: 'org-embedded',
      customerId: null,
    });

    const result = await whatsappWebhookService.ingest({
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'waba-1',
          changes: [
            {
              field: 'messages',
              value: {
                metadata: { phone_number_id: '1198471690026354' },
                statuses: [
                  {
                    id: 'wamid.outbound-1',
                    status: 'failed',
                    timestamp: '1700000100',
                    recipient_id: '919999000011',
                    errors: [{ code: 131047, title: 'Re-engagement message' }],
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    expect(result).toEqual({ stored: 0 });
    expect(updateMessageStatus).toHaveBeenCalledWith('wamid.outbound-1', 'failed');
  });
});
