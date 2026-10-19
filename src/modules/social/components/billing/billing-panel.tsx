'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/shared/components/ui/button';

interface BillingInvoice {
  id: string;
  number: string;
  gstin: string | null;
  buyerGstin: string | null;
  placeOfSupply: string | null;
  plan: string | null;
  totalPaise: number;
  taxableAmountPaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  pdfUrl: string | null;
  status: string;
  createdAt: string;
}

interface AiUsageClientRow {
  customerId: string | null;
  customerName: string | null;
  costUsd: number;
  budgetUsd: number | null;
}

interface BillingStatus {
  razorpayConfigured: boolean;
  keyId: string | null;
  buyerGstin: string | null;
  placeOfSupply: string | null;
  plan: {
    key: string;
    label: string;
    priceInr: number;
    catalog: { key: string; label: string; priceInr: number; maxClients: number; maxUsers: number }[];
  };
  subscription: { status: string; plan: string } | null;
  invoices: BillingInvoice[];
  aiUsage?: {
    monthStart: string;
    organizationCostUsd: number;
    organizationBudgetUsd: number;
    byClient: AiUsageClientRow[];
  };
}

function formatInr(paise: number) {
  return `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatUsd(amount: number) {
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
}

export function BillingPanel() {
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [buyerGstin, setBuyerGstin] = useState('');
  const [placeOfSupply, setPlaceOfSupply] = useState('');
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);

  async function refresh() {
    const response = await fetch('/api/social/billing');
    const data = (await response.json()) as BillingStatus;
    setStatus(data);
    setBuyerGstin(data.buyerGstin ?? '');
    setPlaceOfSupply(data.placeOfSupply ?? '');
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function checkout(plan: string) {
    setMessage(null);
    const response = await fetch('/api/social/billing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plan,
        mode: 'subscription',
        buyerGstin: buyerGstin.trim() || null,
        placeOfSupply: placeOfSupply.trim() || null,
      }),
    });
    const order = (await response.json()) as {
      error?: string;
      keyId?: string;
      orderId?: string;
      subscriptionId?: string;
      amount?: number;
      name?: string;
      mode?: string;
    };
    if (!response.ok || !order.keyId) {
      setMessage(order.error || 'Could not start checkout');
      return;
    }

    const Razorpay = (window as unknown as { Razorpay?: new (options: object) => { open: () => void } })
      .Razorpay;
    if (!Razorpay) {
      const ref = order.orderId ?? order.subscriptionId ?? 'pending';
      setMessage(`Checkout ${ref} created (${order.mode}). Load Razorpay Checkout to pay ${formatInr(order.amount ?? 0)}.`);
      return;
    }

    const options: Record<string, unknown> = {
      key: order.keyId,
      amount: order.amount,
      currency: 'INR',
      name: 'Podo Social',
      description: order.name,
      handler: () => setMessage('Payment received. The plan and GST invoice update when the Razorpay webhook arrives.'),
    };
    if (order.orderId) options.order_id = order.orderId;
    if (order.subscriptionId) options.subscription_id = order.subscriptionId;

    const checkout = new Razorpay(options);
    checkout.open();
  }

  async function regeneratePdf(invoiceId: string) {
    setRegeneratingId(invoiceId);
    setMessage(null);
    try {
      const response = await fetch(`/api/social/billing/invoices/${invoiceId}/pdf`, {
        method: 'POST',
      });
      const data = (await response.json()) as { error?: string; pdfUrl?: string | null };
      if (!response.ok) {
        setMessage(data.error || 'Could not regenerate PDF');
        return;
      }
      await refresh();
      setMessage(data.pdfUrl ? 'Invoice PDF ready.' : 'PDF generated but URL missing.');
    } finally {
      setRegeneratingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <p className="text-muted-foreground text-sm">
          Current plan: {status?.plan.label ?? '…'}{' '}
          {status?.subscription ? `· ${status.subscription.status}` : ''}
        </p>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground text-xs">Buyer GSTIN (optional)</span>
            <input
              className="border-border bg-background w-full rounded-lg border px-3 py-2 text-sm"
              value={buyerGstin}
              onChange={(event) => setBuyerGstin(event.target.value)}
              placeholder="22AAAAA0000A1Z5"
              maxLength={20}
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground text-xs">Place of supply (state / code)</span>
            <input
              className="border-border bg-background w-full rounded-lg border px-3 py-2 text-sm"
              value={placeOfSupply}
              onChange={(event) => setPlaceOfSupply(event.target.value)}
              placeholder="27 or Maharashtra"
              maxLength={120}
            />
          </label>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {status?.plan.catalog.map((plan) => (
            <article key={plan.key} className="border-border space-y-2 rounded-2xl border p-4">
              <h2 className="font-semibold">{plan.label}</h2>
              <p className="text-sm">₹{plan.priceInr.toLocaleString('en-IN')}/month</p>
              <p className="text-muted-foreground text-xs">
                {plan.maxClients} clients · {plan.maxUsers} users
              </p>
              <Button
                type="button"
                variant={plan.key === status.plan.key ? 'secondary' : 'primary'}
                onClick={() => void checkout(plan.key)}
                disabled={!status.razorpayConfigured}
              >
                Choose
              </Button>
            </article>
          ))}
        </div>
        {message && <p className="text-muted-foreground text-sm">{message}</p>}
        {status && !status.razorpayConfigured && (
          <p className="text-muted-foreground text-xs">
            Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to enable checkout.
          </p>
        )}
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">AI usage (month to date)</h2>
        {!status?.aiUsage ? (
          <p className="text-muted-foreground text-xs">Loading AI spend…</p>
        ) : (
          <div className="border-border space-y-3 rounded-2xl border p-4 text-sm">
            <p>
              Workspace:{' '}
              <span className="font-medium">
                {formatUsd(status.aiUsage.organizationCostUsd)}
              </span>{' '}
              of {formatUsd(status.aiUsage.organizationBudgetUsd)}
            </p>
            {!status.aiUsage.byClient.length ? (
              <p className="text-muted-foreground text-xs">No Claude calls recorded this month.</p>
            ) : (
              <ul className="divide-border divide-y text-xs">
                {status.aiUsage.byClient.map((row) => (
                  <li
                    key={row.customerId ?? '__agency__'}
                    className="flex flex-wrap items-center justify-between gap-2 py-2"
                  >
                    <span>{row.customerName ?? 'Agency / unscoped'}</span>
                    <span className="text-muted-foreground">
                      {formatUsd(row.costUsd)}
                      {row.budgetUsd != null ? ` / ${formatUsd(row.budgetUsd)} cap` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-muted-foreground text-[11px]">
              Per-client caps are optional; when set, further AI calls for that client return a clear budget error.
            </p>
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">GST invoices</h2>
        {!status?.invoices?.length ? (
          <p className="text-muted-foreground text-xs">
            Invoices appear after a successful Razorpay payment webhook. PDFs are generated automatically.
          </p>
        ) : (
          <ul className="divide-border border-border divide-y rounded-2xl border text-sm">
            {status.invoices.map((invoice) => (
              <li key={invoice.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <div>
                  <p className="font-medium">{invoice.number}</p>
                  <p className="text-muted-foreground text-xs">
                    {invoice.plan ?? 'plan'} · {new Date(invoice.createdAt).toLocaleDateString('en-IN')}
                    {invoice.gstin ? ` · Seller ${invoice.gstin}` : ''}
                    {invoice.buyerGstin ? ` · Buyer ${invoice.buyerGstin}` : ''}
                    {invoice.placeOfSupply ? ` · PoS ${invoice.placeOfSupply}` : ''}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-right">
                  <div>
                    <p>{formatInr(invoice.totalPaise)}</p>
                    <p className="text-muted-foreground text-xs">
                      Taxable {formatInr(invoice.taxableAmountPaise)}
                      {invoice.igstPaise > 0
                        ? ` · IGST ${formatInr(invoice.igstPaise)}`
                        : ` · CGST ${formatInr(invoice.cgstPaise)} · SGST ${formatInr(invoice.sgstPaise)}`}
                    </p>
                  </div>
                  {invoice.pdfUrl ? (
                    <a
                      href={invoice.pdfUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary text-xs underline"
                    >
                      Download PDF
                    </a>
                  ) : null}
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void regeneratePdf(invoice.id)}
                    disabled={regeneratingId === invoice.id}
                  >
                    {regeneratingId === invoice.id ? 'Generating…' : invoice.pdfUrl ? 'Regenerate' : 'Generate PDF'}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
