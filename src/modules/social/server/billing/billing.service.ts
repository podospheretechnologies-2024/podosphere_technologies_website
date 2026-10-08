import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { prisma } from '@/shared/lib/prisma';
import { getServerEnv } from '@/shared/lib/env';
import { HttpError } from '@/shared/server/http-error';
import { isPlanKey, PLANS, type PlanKey } from '../../config/plans';
import { planService } from './plan.service';

function credentials() {
  const env = getServerEnv();
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    throw new HttpError(503, 'Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to take payments');
  }
  return { keyId: env.RAZORPAY_KEY_ID, secret: env.RAZORPAY_KEY_SECRET };
}

export const billingService = {
  async status(organizationId: string) {
    const plan = await planService.get(organizationId);
    const subscription = await prisma.socialSubscription.findUnique({ where: { organizationId } });
    return {
      plan,
      subscription,
      razorpayConfigured: Boolean(getServerEnv().RAZORPAY_KEY_ID && getServerEnv().RAZORPAY_KEY_SECRET),
      keyId: getServerEnv().RAZORPAY_KEY_ID ?? null,
    };
  },

  async createOrder(organizationId: string, plan: PlanKey) {
    const { keyId, secret } = credentials();
    const definition = PLANS[plan];
    const amount = definition.priceInr * 100;
    const auth = Buffer.from(`${keyId}:${secret}`).toString('base64');
    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount,
        currency: 'INR',
        receipt: `podo_${organizationId.slice(0, 8)}_${plan}`.slice(0, 40),
        notes: { organizationId, plan },
      }),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      id?: string;
      error?: { description?: string };
    };
    if (!response.ok || !payload.id) {
      throw new HttpError(502, payload.error?.description || 'Razorpay order failed');
    }
    await prisma.socialSubscription.upsert({
      where: { organizationId },
      create: { organizationId, plan, razorpayOrderId: payload.id, status: 'created' },
      update: { plan, razorpayOrderId: payload.id, status: 'created' },
    });
    return {
      keyId,
      orderId: payload.id,
      amount,
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
    if (!signature) {
      throw new HttpError(401, 'Missing Razorpay signature');
    }
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new HttpError(401, 'Invalid Razorpay signature');
    }
  },

  async applyWebhook(payload: {
    event?: string;
    payload?: {
      payment?: { entity?: { order_id?: string; notes?: { organizationId?: string; plan?: string } } };
      order?: { entity?: { id?: string; notes?: { organizationId?: string; plan?: string } } };
    };
  }) {
    const notes =
      payload.payload?.payment?.entity?.notes ?? payload.payload?.order?.entity?.notes ?? {};
    const organizationId = notes.organizationId;
    const plan = notes.plan;
    if (!organizationId || !plan || !isPlanKey(plan)) {
      return { applied: false };
    }
    if (payload.event === 'payment.captured' || payload.event === 'order.paid') {
      await planService.apply(organizationId, plan);
      await prisma.socialSubscription.upsert({
        where: { organizationId },
        create: {
          organizationId,
          plan,
          status: 'active',
          razorpayOrderId: payload.payload?.order?.entity?.id ?? payload.payload?.payment?.entity?.order_id,
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
        update: {
          plan,
          status: 'active',
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });
      return { applied: true };
    }
    return { applied: false };
  },
};
