import 'server-only';
import { Readable } from 'node:stream';
import Razorpay from 'razorpay';
import { prisma } from '@/shared/lib/prisma';
import { getServerEnv } from '@/shared/lib/env';
import { HttpError } from '@/shared/server/http-error';
import {
  billingGstPercent,
  billingSellerGstin,
  billingSellerStateCode,
  gstStateCode,
  razorpayPlanId,
} from '../../config/billing';
import { isPlanKey, PLANS, type PlanKey } from '../../config/plans';
import { getAiUsageMonthSummary } from '../ai/claude.client';
import { getStorage } from '../storage/storage.factory';
import { planService } from './plan.service';
import {
  subscriptionStatusForRazorpayEvent,
  verifyRazorpayWebhookSignature,
} from './razorpay-webhook';

type RazorpayClient = InstanceType<typeof Razorpay>;

export type BillingBuyerFields = {
  buyerGstin?: string | null;
  placeOfSupply?: string | null;
};

function credentials(): { keyId: string; secret: string } | null {
  const env = getServerEnv();
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    return null;
  }
  return { keyId: env.RAZORPAY_KEY_ID, secret: env.RAZORPAY_KEY_SECRET };
}

function requireCredentials() {
  const creds = credentials();
  if (!creds) {
    throw new HttpError(503, 'Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to take payments');
  }
  return creds;
}

function client(): RazorpayClient {
  const { keyId, secret } = requireCredentials();
  return new Razorpay({ key_id: keyId, key_secret: secret });
}

function normalizeOptional(value: string | null | undefined, max: number): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

function bufferToReadableStream(buffer: Buffer): ReadableStream<Uint8Array> {
  return Readable.toWeb(Readable.from(buffer)) as ReadableStream<Uint8Array>;
}

function splitGst(
  totalPaise: number,
  opts?: { placeOfSupply?: string | null; buyerGstin?: string | null }
) {
  const percent = billingGstPercent();
  const taxable = Math.round(totalPaise / (1 + percent / 100));
  const tax = totalPaise - taxable;
  const sellerState = billingSellerStateCode();
  const buyerState =
    gstStateCode(opts?.placeOfSupply) ?? gstStateCode(opts?.buyerGstin);
  const interState = Boolean(sellerState && buyerState && sellerState !== buyerState);

  if (interState) {
    return {
      taxableAmountPaise: taxable,
      cgstPaise: 0,
      sgstPaise: 0,
      igstPaise: tax,
      totalPaise,
    };
  }

  const half = Math.floor(tax / 2);
  return {
    taxableAmountPaise: taxable,
    cgstPaise: half,
    sgstPaise: tax - half,
    igstPaise: 0,
    totalPaise,
  };
}

async function nextInvoiceNumber(organizationId: string): Promise<string> {
  const year = new Date().getUTCFullYear();
  const count = await prisma.billingInvoice.count({ where: { organizationId } });
  const seq = String(count + 1).padStart(4, '0');
  return `INV-${year}-${organizationId.slice(0, 6).toUpperCase()}-${seq}`;
}

async function saveBuyerFields(organizationId: string, fields: BillingBuyerFields) {
  const buyerGstin = normalizeOptional(fields.buyerGstin, 20);
  const placeOfSupply = normalizeOptional(fields.placeOfSupply, 120);
  if (fields.buyerGstin === undefined && fields.placeOfSupply === undefined) {
    return;
  }
  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      ...(fields.buyerGstin !== undefined ? { buyerGstin } : {}),
      ...(fields.placeOfSupply !== undefined ? { placeOfSupply } : {}),
    },
  });
}

async function attachInvoicePdf(invoiceId: string) {
  const invoice = await prisma.billingInvoice.findUnique({
    where: { id: invoiceId },
    include: { organization: { select: { name: true } } },
  });
  if (!invoice) {
    throw new HttpError(404, 'Invoice not found');
  }

  const planKey = invoice.plan && isPlanKey(invoice.plan) ? invoice.plan : null;
  const { renderBillingInvoicePdf } = await import('./invoice-pdf');
  const pdfBuffer = await renderBillingInvoicePdf({
    number: invoice.number,
    issuedAt: invoice.createdAt.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }),
    organizationName: invoice.organization.name,
    sellerGstin: invoice.gstin,
    buyerGstin: invoice.buyerGstin,
    placeOfSupply: invoice.placeOfSupply,
    planLabel: planKey ? PLANS[planKey].label : (invoice.plan ?? 'Subscription'),
    taxableAmountPaise: invoice.taxableAmountPaise,
    cgstPaise: invoice.cgstPaise,
    sgstPaise: invoice.sgstPaise,
    igstPaise: invoice.igstPaise,
    totalPaise: invoice.totalPaise,
    currency: invoice.currency,
    gstPercent: billingGstPercent(),
  });

  const storage = getStorage();
  const stored = await storage.save(bufferToReadableStream(pdfBuffer), {
    extension: 'pdf',
    mimeType: 'application/pdf',
  });

  return prisma.billingInvoice.update({
    where: { id: invoiceId },
    data: {
      pdfUrl: stored.url,
      metadata: {
        ...(typeof invoice.metadata === 'object' && invoice.metadata && !Array.isArray(invoice.metadata)
          ? (invoice.metadata as Record<string, unknown>)
          : {}),
        gstPercent: billingGstPercent(),
        pdfGeneratedAt: new Date().toISOString(),
      },
    },
  });
}

async function createInvoiceRow(input: {
  organizationId: string;
  plan: PlanKey;
  totalPaise: number;
  razorpayPaymentId?: string | null;
  razorpayOrderId?: string | null;
}) {
  const org = await prisma.organization.findUnique({
    where: { id: input.organizationId },
    select: { buyerGstin: true, placeOfSupply: true },
  });
  const amounts = splitGst(input.totalPaise, {
    placeOfSupply: org?.placeOfSupply,
    buyerGstin: org?.buyerGstin,
  });
  const number = await nextInvoiceNumber(input.organizationId);
  const invoice = await prisma.billingInvoice.create({
    data: {
      organizationId: input.organizationId,
      number,
      gstin: billingSellerGstin(),
      buyerGstin: org?.buyerGstin ?? null,
      placeOfSupply: org?.placeOfSupply ?? null,
      plan: input.plan,
      ...amounts,
      currency: 'INR',
      pdfUrl: null,
      razorpayPaymentId: input.razorpayPaymentId ?? null,
      razorpayOrderId: input.razorpayOrderId ?? null,
      status: 'issued',
      metadata: {
        gstPercent: billingGstPercent(),
      },
    },
  });

  try {
    return await attachInvoicePdf(invoice.id);
  } catch (error) {
    console.error('[billing] invoice PDF generation failed', error);
    return invoice;
  }
}

function mapInvoice(row: {
  id: string;
  number: string;
  gstin: string | null;
  buyerGstin: string | null;
  placeOfSupply: string | null;
  plan: string | null;
  taxableAmountPaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  totalPaise: number;
  currency: string;
  pdfUrl: string | null;
  status: string;
  createdAt: Date;
}) {
  return {
    id: row.id,
    number: row.number,
    gstin: row.gstin,
    buyerGstin: row.buyerGstin,
    placeOfSupply: row.placeOfSupply,
    plan: row.plan,
    taxableAmountPaise: row.taxableAmountPaise,
    cgstPaise: row.cgstPaise,
    sgstPaise: row.sgstPaise,
    igstPaise: row.igstPaise,
    totalPaise: row.totalPaise,
    currency: row.currency,
    pdfUrl: row.pdfUrl,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Free-tier fallback when a subscription is halted or cancelled. */
const DOWNGRADE_PLAN: PlanKey = 'solo';

type RazorpayWebhookNotes = {
  organizationId?: string;
  plan?: string;
};

type RazorpayWebhookPayload = {
  event?: string;
  payload?: {
    payment?: {
      entity?: {
        id?: string;
        amount?: number;
        order_id?: string;
        notes?: RazorpayWebhookNotes;
      };
    };
    order?: {
      entity?: {
        id?: string;
        amount?: number;
        notes?: RazorpayWebhookNotes;
      };
    };
    subscription?: {
      entity?: {
        id?: string;
        status?: string;
        current_end?: number | null;
        notes?: RazorpayWebhookNotes;
      };
    };
  };
};

function periodEndFromUnix(
  seconds: number | null | undefined,
  fallbackDays = 30
): Date | null {
  if (typeof seconds === 'number' && seconds > 0) {
    return new Date(seconds * 1000);
  }
  if (fallbackDays <= 0) return null;
  return new Date(Date.now() + fallbackDays * 24 * 60 * 60 * 1000);
}

function mergeWebhookNotes(
  ...candidates: Array<RazorpayWebhookNotes | undefined>
): RazorpayWebhookNotes {
  const merged: RazorpayWebhookNotes = {};
  for (const candidate of candidates) {
    if (!candidate) continue;
    if (!merged.organizationId && candidate.organizationId) {
      merged.organizationId = candidate.organizationId;
    }
    if (!merged.plan && candidate.plan) {
      merged.plan = candidate.plan;
    }
  }
  return merged;
}

async function resolveWebhookContext(payload: RazorpayWebhookPayload): Promise<{
  organizationId: string;
  plan: PlanKey;
  subscriptionId: string | null;
} | null> {
  const subscriptionId = payload.payload?.subscription?.entity?.id ?? null;
  const notes = mergeWebhookNotes(
    payload.payload?.subscription?.entity?.notes,
    payload.payload?.payment?.entity?.notes,
    payload.payload?.order?.entity?.notes
  );

  let organizationId = notes.organizationId?.trim() || null;
  let planRaw = notes.plan?.trim() || null;

  if (subscriptionId && (!organizationId || !planRaw)) {
    const existing = await prisma.socialSubscription.findFirst({
      where: { razorpaySubscriptionId: subscriptionId },
      select: { organizationId: true, plan: true },
    });
    if (existing) {
      organizationId = organizationId ?? existing.organizationId;
      planRaw = planRaw ?? existing.plan;
    }
  }

  if (!organizationId || !planRaw || !isPlanKey(planRaw)) {
    return null;
  }
  return { organizationId, plan: planRaw, subscriptionId };
}

async function markSubscription(
  organizationId: string,
  data: {
    plan: PlanKey;
    status: string;
    razorpayOrderId?: string | null;
    razorpaySubscriptionId?: string | null;
    currentPeriodEnd?: Date | null;
  }
) {
  await prisma.socialSubscription.upsert({
    where: { organizationId },
    create: {
      organizationId,
      plan: data.plan,
      status: data.status,
      razorpayOrderId: data.razorpayOrderId ?? null,
      razorpaySubscriptionId: data.razorpaySubscriptionId ?? null,
      currentPeriodEnd: data.currentPeriodEnd ?? null,
    },
    update: {
      plan: data.plan,
      status: data.status,
      ...(data.razorpayOrderId != null ? { razorpayOrderId: data.razorpayOrderId } : {}),
      ...(data.razorpaySubscriptionId != null
        ? { razorpaySubscriptionId: data.razorpaySubscriptionId }
        : {}),
      ...(data.currentPeriodEnd !== undefined ? { currentPeriodEnd: data.currentPeriodEnd } : {}),
    },
  });
}

export const billingService = {
  async status(organizationId: string) {
    const plan = await planService.get(organizationId);
    const [subscription, invoices, organization, aiUsage] = await Promise.all([
      prisma.socialSubscription.findUnique({ where: { organizationId } }),
      prisma.billingInvoice.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      prisma.organization.findUnique({
        where: { id: organizationId },
        select: { buyerGstin: true, placeOfSupply: true },
      }),
      getAiUsageMonthSummary(organizationId),
    ]);
    const creds = credentials();
    return {
      plan,
      subscription,
      buyerGstin: organization?.buyerGstin ?? null,
      placeOfSupply: organization?.placeOfSupply ?? null,
      invoices: invoices.map(mapInvoice),
      razorpayConfigured: Boolean(creds),
      keyId: creds?.keyId ?? null,
      aiUsage,
    };
  },

  /** One-time order checkout (default when no Razorpay Plan ID is mapped). */
  async createOrder(organizationId: string, plan: PlanKey, buyer: BillingBuyerFields = {}) {
    await saveBuyerFields(organizationId, buyer);
    const { keyId } = requireCredentials();
    const definition = PLANS[plan];
    const amount = definition.priceInr * 100;
    const rzp = client();
    const order = (await rzp.orders.create({
      amount,
      currency: 'INR',
      receipt: `podo_${organizationId.slice(0, 8)}_${plan}`.slice(0, 40),
      notes: { organizationId, plan },
    })) as { id: string };

    await prisma.socialSubscription.upsert({
      where: { organizationId },
      create: { organizationId, plan, razorpayOrderId: order.id, status: 'created' },
      update: { plan, razorpayOrderId: order.id, status: 'created' },
    });

    return {
      mode: 'order' as const,
      keyId,
      orderId: order.id,
      amount,
      currency: 'INR',
      plan,
      name: definition.label,
    };
  },

  /**
   * Create a Razorpay subscription when `RAZORPAY_PLAN_*` is set for the plan;
   * otherwise fall back to a one-time order (see createOrder).
   *
   * Requires dashboard Plans + webhook events (see docs/ops-runbook.md § Razorpay).
   */
  async createSubscription(organizationId: string, plan: PlanKey, buyer: BillingBuyerFields = {}) {
    const planId = razorpayPlanId(plan);
    if (!planId) {
      return this.createOrder(organizationId, plan, buyer);
    }

    await saveBuyerFields(organizationId, buyer);
    const { keyId } = requireCredentials();
    const definition = PLANS[plan];
    const rzp = client();
    const subscription = (await rzp.subscriptions.create({
      plan_id: planId,
      total_count: 12,
      customer_notify: 1,
      notes: { organizationId, plan },
    })) as { id: string; status?: string; current_end?: number | null };

    const periodEnd =
      typeof subscription.current_end === 'number' && subscription.current_end > 0
        ? new Date(subscription.current_end * 1000)
        : null;

    await prisma.socialSubscription.upsert({
      where: { organizationId },
      create: {
        organizationId,
        plan,
        razorpaySubscriptionId: subscription.id,
        status: subscription.status === 'active' ? 'active' : 'created',
        currentPeriodEnd: periodEnd,
      },
      update: {
        plan,
        razorpaySubscriptionId: subscription.id,
        status: subscription.status === 'active' ? 'active' : 'created',
        currentPeriodEnd: periodEnd,
      },
    });

    return {
      mode: 'subscription' as const,
      keyId,
      subscriptionId: subscription.id,
      amount: definition.priceInr * 100,
      currency: 'INR',
      plan,
      name: definition.label,
    };
  },

  async confirmPayment(organizationId: string, orderId: string, plan: string) {
    if (!isPlanKey(plan)) {
      throw new HttpError(400, 'Unknown plan');
    }
    const row = await prisma.socialSubscription.findUnique({ where: { organizationId } });
    if (!row || row.razorpayOrderId !== orderId) {
      throw new HttpError(400, 'Order does not match this workspace');
    }
    await prisma.socialSubscription.update({
      where: { organizationId },
      data: { status: 'active', plan, currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
    });
    await planService.apply(organizationId, plan);
  },

  verifyWebhook(rawBody: string, signature: string | null) {
    const secret = getServerEnv().RAZORPAY_WEBHOOK_SECRET;
    if (!secret) {
      throw new HttpError(503, 'RAZORPAY_WEBHOOK_SECRET is not set');
    }
    verifyRazorpayWebhookSignature(rawBody, signature, secret);
  },

  /**
   * Razorpay webhook handler.
   *
   * Status transitions on SocialSubscription:
   * - payment.captured | order.paid | subscription.activated | subscription.charged → active (+ plan entitlements + invoice)
   * - subscription.halted → past_due (+ downgrade org to solo)
   * - subscription.cancelled → cancelled (+ downgrade org to solo)
   */
  async applyWebhook(payload: RazorpayWebhookPayload) {
    const event = payload.event;
    if (!event) {
      return { applied: false };
    }

    const ctx = await resolveWebhookContext(payload);
    if (!ctx) {
      return { applied: false };
    }
    const { organizationId, plan, subscriptionId } = ctx;
    const status = subscriptionStatusForRazorpayEvent(event);

    if (status === 'past_due') {
      await markSubscription(organizationId, {
        plan,
        status: 'past_due',
        razorpaySubscriptionId: subscriptionId,
        currentPeriodEnd: periodEndFromUnix(
          payload.payload?.subscription?.entity?.current_end,
          0
        ),
      });
      // Clear paid entitlements until the customer restores the subscription.
      await planService.apply(organizationId, DOWNGRADE_PLAN);
      return { applied: true, status: 'past_due' as const };
    }

    if (status === 'cancelled') {
      await markSubscription(organizationId, {
        plan,
        status: 'cancelled',
        razorpaySubscriptionId: subscriptionId,
        currentPeriodEnd: null,
      });
      await planService.apply(organizationId, DOWNGRADE_PLAN);
      return { applied: true, status: 'cancelled' as const };
    }

    if (status !== 'active') {
      return { applied: false };
    }

    await planService.apply(organizationId, plan);
    const orderId =
      payload.payload?.order?.entity?.id ?? payload.payload?.payment?.entity?.order_id ?? null;
    const paymentId = payload.payload?.payment?.entity?.id ?? null;

    await markSubscription(organizationId, {
      plan,
      status: 'active',
      razorpayOrderId: orderId,
      razorpaySubscriptionId: subscriptionId,
      currentPeriodEnd: periodEndFromUnix(payload.payload?.subscription?.entity?.current_end),
    });

    const totalPaise =
      payload.payload?.payment?.entity?.amount ??
      payload.payload?.order?.entity?.amount ??
      PLANS[plan].priceInr * 100;

    const dedupeClauses = [
      ...(paymentId ? [{ razorpayPaymentId: paymentId }] : []),
      ...(orderId ? [{ razorpayOrderId: orderId }] : []),
    ];
    const existing =
      dedupeClauses.length > 0
        ? await prisma.billingInvoice.findFirst({
            where: { organizationId, OR: dedupeClauses },
          })
        : null;
    if (!existing) {
      await createInvoiceRow({
        organizationId,
        plan,
        totalPaise,
        razorpayPaymentId: paymentId,
        razorpayOrderId: orderId,
      });
    }

    return { applied: true, status: 'active' as const };
  },

  async regenerateInvoicePdf(organizationId: string, invoiceId: string) {
    const invoice = await prisma.billingInvoice.findFirst({
      where: { id: invoiceId, organizationId },
    });
    if (!invoice) {
      throw new HttpError(404, 'Invoice not found');
    }
    const updated = await attachInvoicePdf(invoice.id);
    return mapInvoice(updated);
  },
};
