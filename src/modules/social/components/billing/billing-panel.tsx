'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/shared/components/ui/button';

interface BillingStatus {
  razorpayConfigured: boolean;
  keyId: string | null;
  plan: { key: string; label: string; priceInr: number; catalog: { key: string; label: string; priceInr: number; maxClients: number; maxUsers: number }[] };
  subscription: { status: string; plan: string } | null;
}

export function BillingPanel() {
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void fetch('/api/social/billing').then((response) => response.json()).then((data: BillingStatus) => setStatus(data));
  }, []);

  async function checkout(plan: string) {
    setMessage(null);
    const response = await fetch('/api/social/billing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan }),
    });
    const order = (await response.json()) as { error?: string; keyId?: string; orderId?: string; amount?: number; name?: string };
    if (!response.ok || !order.orderId || !order.keyId) {
      setMessage(order.error || 'Could not start checkout');
      return;
    }
    const Razorpay = (window as unknown as { Razorpay?: new (options: object) => { open: () => void } }).Razorpay;
    if (!Razorpay) {
      setMessage(`Order ${order.orderId} created. Load Razorpay Checkout to pay ₹${(order.amount ?? 0) / 100}.`);
      return;
    }
    const checkout = new Razorpay({
      key: order.keyId,
      amount: order.amount,
      currency: 'INR',
      name: 'Podo Social',
      description: order.name,
      order_id: order.orderId,
      handler: () => setMessage('Payment received. The plan updates when the Razorpay webhook arrives.'),
    });
    checkout.open();
  }

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">Current plan: {status?.plan.label ?? '…'} {status?.subscription ? `· ${status.subscription.status}` : ''}</p>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {status?.plan.catalog.map((plan) => (
          <article key={plan.key} className="border-border space-y-2 rounded-2xl border p-4">
            <h2 className="font-semibold">{plan.label}</h2>
            <p className="text-sm">₹{plan.priceInr.toLocaleString('en-IN')}/month</p>
            <p className="text-muted-foreground text-xs">{plan.maxClients} clients · {plan.maxUsers} users</p>
            <Button type="button" variant={plan.key === status.plan.key ? 'secondary' : 'primary'} onClick={() => void checkout(plan.key)} disabled={!status.razorpayConfigured}>
              Choose
            </Button>
          </article>
        ))}
      </div>
      {message && <p className="text-muted-foreground text-sm">{message}</p>}
      {status && !status.razorpayConfigured && <p className="text-muted-foreground text-xs">Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to enable checkout.</p>}
    </div>
  );
}
