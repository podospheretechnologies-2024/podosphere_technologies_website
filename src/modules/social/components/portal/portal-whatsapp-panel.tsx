import type { PortalWhatsAppSummary } from '@/modules/social/server/portal/portal-whatsapp.service';

function formatInr(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
}

export function PortalWhatsAppPanel({ data }: { data: PortalWhatsAppSummary }) {
  const orderFlows = data.orderFlows;

  return (
    <>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">WhatsApp</h2>
        <p className="mt-1 text-gray-500">Your linked numbers and recent messaging activity.</p>
      </div>

      <div className="mb-8 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Leads messaged</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{data.leadsMessaged}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Replies</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{data.replies}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Broadcasts sent</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{data.broadcastsSent}</p>
        </div>
      </div>

      {orderFlows ? (
        <div className="mb-8">
          <h3 className="mb-3 text-lg font-semibold text-gray-900">Order recovery</h3>
          <p className="mb-3 text-sm text-gray-500">
            Messages and carts recovered from abandoned checkouts (read-only).
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-sm text-gray-500">Messages sent</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {orderFlows.messagesSent.toLocaleString('en-IN')}
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-sm text-gray-500">Carts recovered</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {orderFlows.cartsRecovered.toLocaleString('en-IN')}
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-sm text-gray-500">Revenue recovered</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {formatInr(orderFlows.revenueRecovered)}
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-sm text-gray-500">Spend estimate</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {orderFlows.moneySpentEstimate > 0
                  ? formatInr(orderFlows.moneySpentEstimate)
                  : '–'}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {data.numbers.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-gray-500">
          No WhatsApp number linked to your brand yet.
        </div>
      ) : (
        <ul className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white">
          {data.numbers.map((number, index) => (
            <li key={`${number.displayPhone ?? 'n'}-${index}`} className="px-4 py-3">
              <p className="text-sm font-medium text-gray-900">
                {number.displayPhone || 'WhatsApp number'}
              </p>
              {number.businessName ? (
                <p className="text-xs text-gray-500">{number.businessName}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
