import Link from 'next/link';
import { Check } from 'lucide-react';
import { PLAN_KEYS, PLANS, type PlanFeature, type PlanKey } from '@/modules/social/config/plans';

const FEATURE_ROWS: { key: PlanFeature | 'limits'; label: string; render?: (plan: PlanKey) => string }[] = [
  {
    key: 'limits',
    label: 'Clients / users / channels',
    render: (plan) => {
      const p = PLANS[plan];
      const users = p.maxUsers >= 999 ? 'Unlimited users' : `${p.maxUsers} users`;
      return `${p.maxClients} clients · ${users} · ${p.maxChannels} channels`;
    },
  },
  { key: 'scheduling', label: 'Scheduling, AI, analytics, WhatsApp' },
  { key: 'approvals', label: 'Approvals, reports, inbox, broadcasts, leads' },
  { key: 'ads', label: 'Ads (Meta + Google)' },
  { key: 'api', label: 'Public API' },
];

function hasFeature(plan: PlanKey, feature: PlanFeature): boolean {
  return (PLANS[plan].features as readonly PlanFeature[]).includes(feature);
}

function withGst(priceInr: number): number {
  return Math.round(priceInr * 1.18);
}

export function PricingGrid({
  highlight = 'agency_starter',
  showCta = true,
}: {
  highlight?: PlanKey;
  showCta?: boolean;
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-4">
        {PLAN_KEYS.map((key) => {
          const plan = PLANS[key];
          const featured = key === highlight;
          return (
            <div
              key={key}
              className={`rounded-2xl border p-6 ${
                featured
                  ? 'border-primary bg-surface shadow-sm'
                  : 'border-border bg-surface'
              }`}
            >
              <p className="text-sm font-semibold">{plan.label}</p>
              <p className="mt-3 text-3xl font-semibold tracking-tight tabular-nums">
                ₹{plan.priceInr.toLocaleString('en-IN')}
                <span className="text-muted-foreground text-sm font-normal"> / mo</span>
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                ₹{withGst(plan.priceInr).toLocaleString('en-IN')} incl. 18% GST
              </p>
              <ul className="mt-6 space-y-3 text-sm">
                {FEATURE_ROWS.map((row) => {
                  if (row.key === 'limits' && row.render) {
                    return (
                      <li key={row.key} className="text-muted-foreground">
                        {row.render(key)}
                      </li>
                    );
                  }
                  const ok = hasFeature(key, row.key as PlanFeature);
                  return (
                    <li key={row.key} className="flex gap-2">
                      {ok ? (
                        <Check className="text-primary mt-0.5 size-4 shrink-0" />
                      ) : (
                        <span className="text-muted-foreground mt-0.5 w-4 shrink-0 text-center">
                          —
                        </span>
                      )}
                      <span className={ok ? '' : 'text-muted-foreground'}>{row.label}</span>
                    </li>
                  );
                })}
              </ul>
              {showCta ? (
                <Link
                  href="/register"
                  className={`mt-6 block rounded-xl px-4 py-2.5 text-center text-sm font-medium ${
                    featured
                      ? 'bg-primary text-primary-foreground hover:opacity-90'
                      : 'border-border hover:bg-surface-muted border'
                  }`}
                >
                  Start free
                </Link>
              ) : null}
            </div>
          );
        })}
      </div>
      <p className="text-muted-foreground text-center text-xs leading-relaxed">
        WhatsApp template messages are billed separately at Meta’s rate (estimate ≈ ₹0.80/msg in
        the product). GST invoices included. Prices read from the same plan config as billing.
      </p>
    </div>
  );
}
