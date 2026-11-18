import 'server-only';
import { prisma } from '@/shared/lib/prisma';
import type { ClientScope } from '@/shared/server/client-scope';
import { ORDER_FLOW_FAIL_PAUSE_THRESHOLD } from '../../config/order-flows';
import { whatsappService } from './whatsapp.service';
import { orderFlowRepository } from './order-flow.repository';

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message.slice(0, 255);
  return 'send_failed';
}

async function recordSendFailure(storeId: string, reason: string) {
  const store = await prisma.socialShopifyStore.update({
    where: { id: storeId },
    data: { consecutiveSendFailures: { increment: 1 } },
    select: { consecutiveSendFailures: true, orderFlowsPaused: true },
  });
  if (
    store.consecutiveSendFailures >= ORDER_FLOW_FAIL_PAUSE_THRESHOLD &&
    !store.orderFlowsPaused
  ) {
    await prisma.socialShopifyStore.update({
      where: { id: storeId },
      data: {
        orderFlowsPaused: true,
        orderFlowsPausedReason: `Paused after ${ORDER_FLOW_FAIL_PAUSE_THRESHOLD} consecutive WhatsApp send failures (${reason})`.slice(
          0,
          255
        ),
      },
    });
  }
}

async function recordSendSuccess(storeId: string) {
  await prisma.socialShopifyStore.update({
    where: { id: storeId },
    data: {
      consecutiveSendFailures: 0,
      // Do not auto-resume; agency must clear pause after investigating.
    },
  });
}

export const orderFlowSender = {
  async sendTemplate(input: {
    scope: ClientScope;
    storeId: string;
    messageId: string;
    to: string;
    templateName: string;
    language: string;
    variables: string[];
    buttonUrlParams?: string[];
  }): Promise<{ ok: true; wamid: string } | { ok: false; reason: string }> {
    try {
      const result = await whatsappService.send(
        input.scope,
        {
          type: 'template',
          to: input.to,
          templateName: input.templateName,
          language: input.language,
          variables: input.variables,
          buttonUrlParams: input.buttonUrlParams,
        },
        { senderName: 'Order flow' }
      );
      await orderFlowRepository.updateMessage(input.messageId, {
        status: 'sent',
        sentAt: new Date(),
        wamid: result.messageId || null,
        statusReason: null,
      });
      await recordSendSuccess(input.storeId);
      return { ok: true, wamid: result.messageId };
    } catch (error) {
      const reason = errorText(error);
      await orderFlowRepository.updateMessage(input.messageId, {
        status: 'failed',
        statusReason: reason,
      });
      await recordSendFailure(input.storeId, reason);
      return { ok: false, reason };
    }
  },

  async pauseStore(storeId: string, reason: string) {
    await prisma.socialShopifyStore.update({
      where: { id: storeId },
      data: {
        orderFlowsPaused: true,
        orderFlowsPausedReason: reason.slice(0, 255),
      },
    });
  },

  async resumeStore(storeId: string) {
    await prisma.socialShopifyStore.update({
      where: { id: storeId },
      data: {
        orderFlowsPaused: false,
        orderFlowsPausedReason: null,
        consecutiveSendFailures: 0,
      },
    });
  },
};
