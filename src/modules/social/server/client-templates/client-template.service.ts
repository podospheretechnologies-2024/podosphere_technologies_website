import 'server-only';
import type { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/shared/lib/prisma';
import { HttpError } from '@/shared/server/http-error';
import type { ClientScope } from '@/shared/server/client-scope';
import { planService } from '../billing/plan.service';
import type {
  ApplyTemplateBody,
  SaveTemplateBody,
} from './client-template.schema';
import type { OnboardingStep } from '../../config/client-onboarding';
import { ONBOARDING_STEPS, isOnboardingStep } from '../../config/client-onboarding';
import type {
  ClientTemplateBootstrap,
  ClientTemplateData,
  ClientTemplatePostingHint,
} from './client-template.types';
import {
  bindSetChannelsFromProviders,
  buildIntegrationIdMap,
  channelProvidersFromContent,
  remapSetIntegrationIds,
  toInputJson,
  type SourceChannelRef,
} from './client-template.remap';

function asTemplateData(raw: Prisma.JsonValue): ClientTemplateData {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return raw as ClientTemplateData;
}

function asBootstrap(raw: Prisma.JsonValue | null | undefined): ClientTemplateBootstrap | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  return raw as ClientTemplateBootstrap;
}

function scopeAllowsCustomer(scope: ClientScope, customerId: string): boolean {
  return scope.customerIds === 'all' || scope.customerIds.includes(customerId);
}

function postingTimesJson(hints: ClientTemplatePostingHint[]): Prisma.InputJsonValue {
  return hints.map((h) => ({ time: h.time })) as unknown as Prisma.InputJsonValue;
}

async function buildSnapshotFromCustomer(
  organizationId: string,
  customerId: string
): Promise<ClientTemplateData> {
  const [brandKit, tags, signatures, sets, integrations] = await Promise.all([
    prisma.socialBrandKit.findFirst({
      where: { organizationId, customerId },
    }),
    prisma.socialTag.findMany({
      where: { organizationId, customerId, deletedAt: null },
      orderBy: { name: 'asc' },
    }),
    prisma.socialSignature.findMany({
      where: { organizationId, customerId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.socialSet.findMany({
      where: { organizationId, customerId },
      orderBy: { name: 'asc' },
    }),
    prisma.socialIntegration.findMany({
      where: { organizationId, customerId, deletedAt: null },
      select: { id: true, providerIdentifier: true, postingTimes: true },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  const sourceChannels: SourceChannelRef[] = integrations.map((i) => ({
    id: i.id,
    providerIdentifier: i.providerIdentifier,
  }));

  const postingScheduleHints = (() => {
    const raw = integrations[0]?.postingTimes;
    if (!Array.isArray(raw)) return undefined;
    const hints = raw
      .map((entry) => {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
        const time = (entry as { time?: unknown }).time;
        return typeof time === 'number' ? { time } : null;
      })
      .filter((v): v is { time: number } => v != null);
    return hints.length > 0 ? hints : undefined;
  })();

  return {
    brandKit: brandKit?.data
      ? (brandKit.data as Record<string, string>)
      : null,
    tags: tags.map((t) => ({ name: t.name, color: t.color })),
    signatures: signatures.map((s) => ({ content: s.content, autoAdd: s.autoAdd })),
    sets: sets.map((s) => ({
      name: s.name,
      content: s.content,
      channelProviders: channelProvidersFromContent(s.content, sourceChannels),
    })),
    postingScheduleHints,
    sourceChannels,
  };
}

function cloneSetContent(
  set: { content: unknown; channelProviders?: string[] },
  sourceChannels: SourceChannelRef[],
  targetChannels: { id: string; providerIdentifier: string }[]
): Prisma.InputJsonValue {
  const providers =
    set.channelProviders && set.channelProviders.length > 0
      ? set.channelProviders
      : channelProvidersFromContent(set.content, sourceChannels);

  const idMap = buildIntegrationIdMap(sourceChannels, targetChannels);
  const remapped = remapSetIntegrationIds(set.content, idMap);

  return toInputJson({
    ...remapped,
    channelProviders: providers.length > 0 ? providers : remapped.channelProviders,
  });
}

export const clientTemplateService = {
  async list(scope: ClientScope) {
    return prisma.socialClientTemplate.findMany({
      where: { organizationId: scope.organizationId },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, name: true, createdAt: true, updatedAt: true },
    });
  },

  async saveFromClient(organizationId: string, body: SaveTemplateBody) {
    let data: ClientTemplateData;
    if (body.sourceCustomerId) {
      const customer = await prisma.socialCustomer.findFirst({
        where: { id: body.sourceCustomerId, organizationId, deletedAt: null },
      });
      if (!customer) throw new HttpError(404, 'Client not found');
      data = await buildSnapshotFromCustomer(organizationId, customer.id);
    } else {
      data = (body.data ?? {}) as ClientTemplateData;
    }

    return prisma.socialClientTemplate.create({
      data: {
        organizationId,
        name: body.name,
        data: data as Prisma.InputJsonValue,
      },
    });
  },

  async applyTemplate(organizationId: string, body: ApplyTemplateBody) {
    const template = await prisma.socialClientTemplate.findFirst({
      where: { id: body.templateId, organizationId },
    });
    if (!template) throw new HttpError(404, 'Template not found');

    await planService.assertClientCapacity(organizationId);

    const snapshot = asTemplateData(template.data);
    const sourceChannels = snapshot.sourceChannels ?? [];
    const bootstrap: ClientTemplateBootstrap = {
      postingScheduleHints: snapshot.postingScheduleHints,
      sourceChannels,
    };

    return prisma.$transaction(async (tx) => {
      const customer = await tx.socialCustomer.create({
        data: {
          organizationId,
          name: body.name,
          onboardingStep: 'created',
          templateBootstrap: bootstrap as Prisma.InputJsonValue,
        },
      });

      await tx.clientApprover.create({
        data: {
          organizationId,
          customerId: customer.id,
          name: body.approverName,
          email: body.approverEmail,
        },
      });

      if (snapshot.brandKit && Object.keys(snapshot.brandKit).length > 0) {
        await tx.socialBrandKit.create({
          data: {
            organizationId,
            customerId: customer.id,
            data: snapshot.brandKit as Prisma.InputJsonValue,
          },
        });
      }

      for (const tag of snapshot.tags ?? []) {
        await tx.socialTag.create({
          data: {
            organizationId,
            customerId: customer.id,
            name: tag.name,
            color: tag.color,
          },
        });
      }

      let autoAddUsed = false;
      for (const sig of snapshot.signatures ?? []) {
        const autoAdd = Boolean(sig.autoAdd) && !autoAddUsed;
        if (autoAdd) autoAddUsed = true;
        await tx.socialSignature.create({
          data: {
            organizationId,
            customerId: customer.id,
            content: sig.content,
            autoAdd,
          },
        });
      }

      // No channels yet → remap drops unmapped IDs; channelProviders kept for later bind.
      for (const set of snapshot.sets ?? []) {
        await tx.socialSet.create({
          data: {
            organizationId,
            customerId: customer.id,
            name: set.name,
            content: cloneSetContent(set, sourceChannels, []),
          },
        });
      }

      return customer;
    });
  },

  /**
   * After OAuth connect for a templated client: apply posting schedule hints
   * onto new integrations and re-bind set channel IDs by providerIdentifier.
   */
  async applyChannelBootstrap(
    organizationId: string,
    customerId: string,
    linkedIntegrations: { id: string; providerIdentifier: string }[]
  ): Promise<void> {
    if (linkedIntegrations.length === 0) return;

    const customer = await prisma.socialCustomer.findFirst({
      where: { id: customerId, organizationId, deletedAt: null },
      select: { id: true, templateBootstrap: true },
    });
    if (!customer) return;

    const bootstrap = asBootstrap(customer.templateBootstrap);
    if (!bootstrap) return;

    const hints = bootstrap.postingScheduleHints;
    if (hints && hints.length > 0) {
      await prisma.socialIntegration.updateMany({
        where: {
          id: { in: linkedIntegrations.map((i) => i.id) },
          organizationId,
          customerId,
          deletedAt: null,
        },
        data: { postingTimes: postingTimesJson(hints) },
      });
    }

    const sourceChannels = bootstrap.sourceChannels ?? [];
    const customerChannels = await prisma.socialIntegration.findMany({
      where: { organizationId, customerId, deletedAt: null },
      select: { id: true, providerIdentifier: true },
      orderBy: { createdAt: 'asc' },
    });

    const sets = await prisma.socialSet.findMany({
      where: { organizationId, customerId },
    });

    for (const set of sets) {
      let next = bindSetChannelsFromProviders(set.content, customerChannels);
      const providers = next.channelProviders;
      if (!providers || providers.length === 0) {
        // Legacy sets: remap stale source IDs via provider match.
        const idMap = buildIntegrationIdMap(sourceChannels, customerChannels);
        next = remapSetIntegrationIds(set.content, idMap);
      }
      await prisma.socialSet.update({
        where: { id: set.id },
        data: { content: toInputJson(next) },
      });
    }
  },

  async getCustomerForOnboarding(scope: ClientScope, customerId: string) {
    if (!scopeAllowsCustomer(scope, customerId)) {
      throw new HttpError(404, 'Not found');
    }
    const customer = await prisma.socialCustomer.findFirst({
      where: { id: customerId, organizationId: scope.organizationId, deletedAt: null },
      include: {
        approvers: true,
        integrations: {
          where: { deletedAt: null },
          select: { id: true, name: true, providerIdentifier: true },
        },
        brandKits: { select: { id: true, updatedAt: true } },
      },
    });
    if (!customer) throw new HttpError(404, 'Not found');

    // If the agency already connected channels for this client, the "connect link" and
    // "channels" steps are redundant — the client was never going to connect something that is
    // already connected. Jump the wizard straight to the brand kit. `channelsConnected` lets the
    // UI (and the client portal) decide whether to show a connect prompt at all.
    const channelsConnected = customer.integrations.length > 0;
    const stepRank = (step: string) =>
      Math.max(0, (ONBOARDING_STEPS as readonly string[]).indexOf(step));
    const onboardingStep =
      channelsConnected && stepRank(customer.onboardingStep) < stepRank('brand_kit')
        ? 'brand_kit'
        : customer.onboardingStep;

    return { ...customer, onboardingStep, channelsConnected };
  },

  async setOnboardingStep(organizationId: string, customerId: string, step: OnboardingStep) {
    if (!isOnboardingStep(step)) throw new HttpError(400, 'Invalid onboarding step');
    const customer = await prisma.socialCustomer.findFirst({
      where: { id: customerId, organizationId, deletedAt: null },
    });
    if (!customer) throw new HttpError(404, 'Client not found');
    return prisma.socialCustomer.update({
      where: { id: customerId },
      data: { onboardingStep: step },
    });
  },
};
