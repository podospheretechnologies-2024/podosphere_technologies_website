import { portalAdsService } from '@/modules/social/server/portal/portal-ads.service';

function CampaignTable({
  rows,
  showSpend,
  currency,
}: {
  rows: { name: string; spend: number | null; impressions: number; clicks: number; leads: number }[];
  showSpend: boolean;
  currency: string;
}) {
  const nf = new Intl.NumberFormat();
  const money = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  });
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-8 text-center text-muted-foreground">
        Campaign stats will show up after the next ads sync.
      </div>
    );
  }
  return (
    <>
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface sm:hidden">
        {rows.map((row) => (
          <li key={row.name} className="space-y-2 px-4 py-3">
            <p className="text-sm font-medium text-foreground">{row.name}</p>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {showSpend && row.spend != null ? (
                <>
                  <dt>Spend</dt>
                  <dd className="text-right tabular-nums text-foreground">{money.format(row.spend)}</dd>
                </>
              ) : null}
              <dt>Impressions</dt>
              <dd className="text-right tabular-nums text-foreground">{nf.format(row.impressions)}</dd>
              <dt>Clicks</dt>
              <dd className="text-right tabular-nums text-foreground">{nf.format(row.clicks)}</dd>
              <dt>Results</dt>
              <dd className="text-right tabular-nums text-foreground">{nf.format(row.leads)}</dd>
            </dl>
          </li>
        ))}
      </ul>
      <div className="hidden overflow-hidden rounded-xl border border-border bg-surface sm:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-surface-muted text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Campaign</th>
              {showSpend ? <th className="px-4 py-3 font-medium">Spend</th> : null}
              <th className="px-4 py-3 font-medium">Impr.</th>
              <th className="px-4 py-3 font-medium">Clicks</th>
              <th className="px-4 py-3 font-medium">Results</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.name} className="border-b border-border last:border-0">
                <td className="px-4 py-3 font-medium text-foreground">{row.name}</td>
                {showSpend && row.spend != null ? (
                  <td className="px-4 py-3">{money.format(row.spend)}</td>
                ) : null}
                <td className="px-4 py-3">{nf.format(row.impressions)}</td>
                <td className="px-4 py-3">{nf.format(row.clicks)}</td>
                <td className="px-4 py-3">{nf.format(row.leads)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export async function PortalAdsPanel({
  organizationId,
  customerId,
}: {
  organizationId: string;
  customerId: string;
}) {
  const ads = await portalAdsService.summary({ organizationId, customerId });
  const nf = new Intl.NumberFormat();
  const metaCurrency = ads.meta.accounts[0]?.currency ?? 'INR';
  const googleCurrency = ads.google.accounts[0]?.currency ?? metaCurrency;
  const metaMoney = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: metaCurrency,
    maximumFractionDigits: 0,
  });
  const googleMoney = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: googleCurrency,
    maximumFractionDigits: 0,
  });

  return (
    <>
      <div className="mb-8">
        <h2 className="text-2xl font-bold">Your ads</h2>
        <p className="mt-1 text-muted-foreground">
          Last 30 days ({ads.since} → {ads.until}). Only your accounts.
        </p>
      </div>

      {ads.meta.accounts.length === 0 && ads.google.accounts.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-12 text-center text-muted-foreground">
          No ad accounts are linked to your brand yet.
        </div>
      ) : (
        <div className="space-y-10">
          {ads.meta.accounts.length > 0 ? (
            <section>
              <p className="mb-3 text-sm font-medium text-foreground">
                Meta · {ads.meta.accounts.map((a) => a.name).join(', ')}
              </p>
              <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {ads.showSpend && ads.meta.spend != null ? (
                  <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
                    <div className="mb-1 text-sm font-medium text-muted-foreground">Spend</div>
                    <div className="text-3xl font-bold text-foreground">
                      {metaMoney.format(ads.meta.spend)}
                    </div>
                  </div>
                ) : null}
                <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
                  <div className="mb-1 text-sm font-medium text-muted-foreground">Impressions</div>
                  <div className="text-3xl font-bold text-foreground">
                    {nf.format(ads.meta.impressions)}
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
                  <div className="mb-1 text-sm font-medium text-muted-foreground">Clicks</div>
                  <div className="text-3xl font-bold text-foreground">{nf.format(ads.meta.clicks)}</div>
                </div>
                <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
                  <div className="mb-1 text-sm font-medium text-muted-foreground">Leads</div>
                  <div className="text-3xl font-bold text-foreground">{nf.format(ads.meta.leads)}</div>
                  {ads.meta.costPerLead != null ? (
                    <div className="mt-1 text-xs text-muted-foreground">
                      {metaMoney.format(ads.meta.costPerLead)} per lead
                    </div>
                  ) : null}
                </div>
                {ads.meta.purchases > 0 ? (
                  <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
                    <div className="mb-1 text-sm font-medium text-muted-foreground">Purchases</div>
                    <div className="text-3xl font-bold text-foreground">{nf.format(ads.meta.purchases)}</div>
                    {ads.showSpend && ads.meta.spend != null ? (
                      <div className="mt-1 text-xs text-muted-foreground">
                        {metaMoney.format(ads.meta.spend / ads.meta.purchases)} per purchase
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <h3 className="mb-3 text-lg font-semibold text-foreground">Top Meta campaigns</h3>
              <CampaignTable rows={ads.meta.campaigns} showSpend={ads.showSpend} currency={metaCurrency} />
            </section>
          ) : null}

          {ads.google.accounts.length > 0 ? (
            <section>
              <p className="mb-3 text-sm font-medium text-foreground">
                Google Ads · {ads.google.accounts.map((a) => a.name).join(', ')}
              </p>
              {ads.google.error ? (
                <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  Could not refresh Google numbers right now. Linked accounts are still shown.
                </div>
              ) : null}
              <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {ads.showSpend && ads.google.spend != null ? (
                  <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
                    <div className="mb-1 text-sm font-medium text-muted-foreground">Spend</div>
                    <div className="text-3xl font-bold text-foreground">
                      {googleMoney.format(ads.google.spend)}
                    </div>
                  </div>
                ) : null}
                <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
                  <div className="mb-1 text-sm font-medium text-muted-foreground">Impressions</div>
                  <div className="text-3xl font-bold text-foreground">
                    {nf.format(ads.google.impressions)}
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
                  <div className="mb-1 text-sm font-medium text-muted-foreground">Clicks</div>
                  <div className="text-3xl font-bold text-foreground">
                    {nf.format(ads.google.clicks)}
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
                  <div className="mb-1 text-sm font-medium text-muted-foreground">Conversions</div>
                  <div className="text-3xl font-bold text-foreground">
                    {nf.format(ads.google.conversions)}
                  </div>
                </div>
              </div>
              <h3 className="mb-3 text-lg font-semibold text-foreground">Top Google campaigns</h3>
              <CampaignTable
                rows={ads.google.campaigns}
                showSpend={ads.showSpend}
                currency={googleCurrency}
              />
            </section>
          ) : null}
        </div>
      )}
    </>
  );
}
