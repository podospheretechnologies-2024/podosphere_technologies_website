import type { PortalSalesSummary } from '@/modules/social/server/portal/portal-sales.service';

function money(value: number | null, currency: string) {
  if (value == null) return '—';
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(0)}`;
  }
}

function count(value: number | null | undefined) {
  if (value == null) return '—';
  return new Intl.NumberFormat().format(value);
}

export function PortalSalesPanel({ data }: { data: PortalSalesSummary }) {
  const shopify = data.shopify;
  const website = data.website;
  const hasShopify = shopify.connected;
  const hasGa4 = Boolean(website?.connected);

  if (!hasShopify && !hasGa4) {
    return (
      <>
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-foreground">Growth</h2>
          <p className="mt-1 text-muted-foreground">Shopify orders and website traffic for your brand.</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-12 text-center text-muted-foreground">
          Your store and website analytics are not connected yet. Ask your agency to link Shopify or
          Google Analytics.
        </div>
      </>
    );
  }

  return (
    <>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-foreground">Growth</h2>
        <p className="mt-1 text-muted-foreground">
          {hasShopify && shopify.shopName ? `${shopify.shopName} · ` : ''}
          {shopify.since} → {shopify.until}
        </p>
      </div>

      {hasShopify ? (
        <>
          <h3 className="mb-3 text-lg font-semibold text-foreground">Shopify</h3>
          <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
              <p className="text-sm text-muted-foreground">Orders</p>
              <p className="mt-1 text-2xl font-bold text-foreground">{shopify.totals.orders}</p>
            </div>
            <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
              <p className="text-sm text-muted-foreground">Revenue</p>
              <p className="mt-1 text-2xl font-bold text-foreground">
                {money(shopify.totals.sales, shopify.currency)}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
              <p className="text-sm text-muted-foreground">AOV</p>
              <p className="mt-1 text-2xl font-bold text-foreground">
                {money(shopify.totals.aov, shopify.currency)}
              </p>
            </div>
            {shopify.showSpend ? (
              <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
                <p className="text-sm text-muted-foreground">ROAS</p>
                <p className="mt-1 text-2xl font-bold text-foreground">
                  {shopify.totals.roas != null ? `${shopify.totals.roas}x` : '—'}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Ad spend {money(shopify.totals.spend, shopify.currency)}
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
                <p className="text-sm text-muted-foreground">Ad spend</p>
                <p className="mt-1 text-sm text-muted-foreground">Hidden for this portal</p>
              </div>
            )}
          </div>

          {shopify.days.length === 0 ? (
            <div className="mb-10 rounded-xl border border-border bg-surface p-12 text-center text-muted-foreground">
              No order data in this period yet.
            </div>
          ) : (
            <>
              <ul className="mb-10 divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface sm:hidden">
                {[...shopify.days].reverse().map((day) => (
                  <li key={day.date} className="flex flex-col gap-1 px-4 py-3">
                    <p className="text-sm font-medium text-foreground">{day.date}</p>
                    <p className="text-xs text-muted-foreground">
                      {day.orders} orders · {money(day.sales, shopify.currency)}
                      {shopify.showSpend
                        ? ` · spend ${money(day.spend, shopify.currency)}`
                        : ''}
                    </p>
                  </li>
                ))}
              </ul>
              <div className="mb-10 hidden overflow-hidden rounded-xl border border-border bg-surface sm:block">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-border bg-surface-muted text-xs font-medium text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Orders</th>
                      <th className="px-4 py-3">Sales</th>
                      {shopify.showSpend ? <th className="px-4 py-3">Ad spend</th> : null}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {[...shopify.days].reverse().map((day) => (
                      <tr key={day.date}>
                        <td className="px-4 py-2.5 text-foreground">{day.date}</td>
                        <td className="px-4 py-2.5 text-foreground">{day.orders}</td>
                        <td className="px-4 py-2.5 text-foreground">
                          {money(day.sales, shopify.currency)}
                        </td>
                        {shopify.showSpend ? (
                          <td className="px-4 py-2.5 text-foreground">
                            {money(day.spend, shopify.currency)}
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      ) : (
        <div className="mb-10 rounded-xl border border-border bg-surface p-8 text-center text-muted-foreground">
          Shopify is not connected yet. Ask your agency to link your store.
        </div>
      )}

      <section>
        <h3 className="mb-3 text-lg font-semibold text-foreground">Website (Google Analytics)</h3>
        {website ? (
          <>
            <p className="mb-3 text-sm text-muted-foreground">
              {website.propertyName ? `${website.propertyName} · ` : ''}
              {website.since && website.until
                ? `${website.since} → ${website.until}`
                : `Last ${website.days} days`}
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
                <p className="text-sm text-muted-foreground">Sessions</p>
                <p className="mt-1 text-2xl font-bold text-foreground">{count(website.sessions)}</p>
              </div>
              <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
                <p className="text-sm text-muted-foreground">Users</p>
                <p className="mt-1 text-2xl font-bold text-foreground">{count(website.users)}</p>
              </div>
              <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
                <p className="text-sm text-muted-foreground">Conversions</p>
                <p className="mt-1 text-2xl font-bold text-foreground">{count(website.conversions)}</p>
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-xl border border-border bg-surface p-8 text-center text-muted-foreground">
            Google Analytics is not linked for your site yet. Ask your agency to assign a GA4
            property.
          </div>
        )}
      </section>
    </>
  );
}
