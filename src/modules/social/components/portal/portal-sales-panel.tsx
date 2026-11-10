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

export function PortalSalesPanel({ data }: { data: PortalSalesSummary }) {
  if (!data.connected) {
    return (
      <>
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900">Sales</h2>
          <p className="mt-1 text-gray-500">Shopify orders, revenue, and ROAS for your store.</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-gray-500">
          Your store is not connected yet. Ask your agency to link Shopify.
        </div>
      </>
    );
  }

  return (
    <>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Sales</h2>
        <p className="mt-1 text-gray-500">
          {data.shopName ? `${data.shopName} · ` : ''}
          {data.since} → {data.until}
        </p>
      </div>

      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Orders</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{data.totals.orders}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Revenue</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">
            {money(data.totals.sales, data.currency)}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">AOV</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">
            {money(data.totals.aov, data.currency)}
          </p>
        </div>
        {data.showSpend ? (
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-gray-500">ROAS</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {data.totals.roas != null ? `${data.totals.roas}x` : '—'}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Ad spend {money(data.totals.spend, data.currency)}
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-gray-500">Ad spend</p>
            <p className="mt-1 text-sm text-gray-500">Hidden for this portal</p>
          </div>
        )}
      </div>

      {data.days.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-gray-500">
          No order data in this period yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-gray-100 bg-gray-50 text-xs font-medium text-gray-500">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Orders</th>
                <th className="px-4 py-3">Sales</th>
                {data.showSpend ? <th className="px-4 py-3">Ad spend</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {[...data.days].reverse().map((day) => (
                <tr key={day.date}>
                  <td className="px-4 py-2.5 text-gray-700">{day.date}</td>
                  <td className="px-4 py-2.5 text-gray-900">{day.orders}</td>
                  <td className="px-4 py-2.5 text-gray-900">{money(day.sales, data.currency)}</td>
                  {data.showSpend ? (
                    <td className="px-4 py-2.5 text-gray-900">{money(day.spend, data.currency)}</td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
