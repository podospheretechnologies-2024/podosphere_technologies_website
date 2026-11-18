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
          <h2 className="text-2xl font-bold text-gray-900">Growth</h2>
          <p className="mt-1 text-gray-500">Shopify orders and website traffic for your brand.</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-gray-500">
          Your store and website analytics are not connected yet. Ask your agency to link Shopify or
          Google Analytics.
        </div>
      </>
    );
  }

  return (
    <>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Growth</h2>
        <p className="mt-1 text-gray-500">
          {hasShopify && shopify.shopName ? `${shopify.shopName} · ` : ''}
          {shopify.since} → {shopify.until}
        </p>
      </div>

      {hasShopify ? (
        <>
          <h3 className="mb-3 text-lg font-semibold text-gray-900">Shopify</h3>
          <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-sm text-gray-500">Orders</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">{shopify.totals.orders}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-sm text-gray-500">Revenue</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {money(shopify.totals.sales, shopify.currency)}
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-sm text-gray-500">AOV</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {money(shopify.totals.aov, shopify.currency)}
              </p>
            </div>
            {shopify.showSpend ? (
              <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <p className="text-sm text-gray-500">ROAS</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">
                  {shopify.totals.roas != null ? `${shopify.totals.roas}x` : '—'}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Ad spend {money(shopify.totals.spend, shopify.currency)}
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <p className="text-sm text-gray-500">Ad spend</p>
                <p className="mt-1 text-sm text-gray-500">Hidden for this portal</p>
              </div>
            )}
          </div>

          {shopify.days.length === 0 ? (
            <div className="mb-10 rounded-xl border border-gray-200 bg-white p-12 text-center text-gray-500">
              No order data in this period yet.
            </div>
          ) : (
            <div className="mb-10 overflow-x-auto rounded-xl border border-gray-200 bg-white">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-gray-100 bg-gray-50 text-xs font-medium text-gray-500">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Orders</th>
                    <th className="px-4 py-3">Sales</th>
                    {shopify.showSpend ? <th className="px-4 py-3">Ad spend</th> : null}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {[...shopify.days].reverse().map((day) => (
                    <tr key={day.date}>
                      <td className="px-4 py-2.5 text-gray-700">{day.date}</td>
                      <td className="px-4 py-2.5 text-gray-900">{day.orders}</td>
                      <td className="px-4 py-2.5 text-gray-900">
                        {money(day.sales, shopify.currency)}
                      </td>
                      {shopify.showSpend ? (
                        <td className="px-4 py-2.5 text-gray-900">
                          {money(day.spend, shopify.currency)}
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <div className="mb-10 rounded-xl border border-gray-200 bg-white p-8 text-center text-gray-500">
          Shopify is not connected yet. Ask your agency to link your store.
        </div>
      )}

      <section>
        <h3 className="mb-3 text-lg font-semibold text-gray-900">Website (Google Analytics)</h3>
        {website ? (
          <>
            <p className="mb-3 text-sm text-gray-500">
              {website.propertyName ? `${website.propertyName} · ` : ''}
              {website.since && website.until
                ? `${website.since} → ${website.until}`
                : `Last ${website.days} days`}
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <p className="text-sm text-gray-500">Sessions</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">{count(website.sessions)}</p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <p className="text-sm text-gray-500">Users</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">{count(website.users)}</p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <p className="text-sm text-gray-500">Conversions</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">{count(website.conversions)}</p>
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-gray-500">
            Google Analytics is not linked for your site yet. Ask your agency to assign a GA4
            property.
          </div>
        )}
      </section>
    </>
  );
}
