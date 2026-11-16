import type { PortalWhatsAppSummary } from '@/modules/social/server/portal/portal-whatsapp.service';

export function PortalWhatsAppPanel({ data }: { data: PortalWhatsAppSummary }) {
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
