import type { PortalLeadsSummary } from '@/modules/social/server/portal/portal-leads.service';

const STAGE_LABELS: Record<string, string> = {
  new: 'New',
  contacted: 'Contacted',
  qualified: 'Qualified',
  won: 'Won',
  lost: 'Lost',
};

export function PortalLeadsPanel({ data }: { data: PortalLeadsSummary }) {
  const stages = Object.keys(data.totals.byStage).sort();

  return (
    <>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Leads</h2>
        <p className="mt-1 text-gray-500">Leads from ads, WhatsApp, and forms for your brand.</p>
      </div>

      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Total shown</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{data.totals.all}</p>
        </div>
        {stages.map((stage) => (
          <div key={stage} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-gray-500">{STAGE_LABELS[stage] ?? stage}</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{data.totals.byStage[stage]}</p>
          </div>
        ))}
      </div>

      {data.leads.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-gray-500">
          No leads yet for your brand.
        </div>
      ) : (
        <ul className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white">
          {data.leads.map((lead) => (
            <li key={lead.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-900">
                  {lead.name || lead.email || lead.phone || 'Lead'}
                </p>
                <p className="text-xs text-gray-500">
                  {[lead.email, lead.phone].filter(Boolean).join(' · ') || 'No contact yet'}
                  {' · '}
                  {lead.source}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3 text-xs text-gray-500">
                <span className="rounded-full bg-gray-100 px-2 py-0.5 font-medium text-gray-700">
                  {STAGE_LABELS[lead.stage] ?? lead.stage}
                </span>
                {lead.score != null ? <span>Score {lead.score}</span> : null}
                <span>{new Date(lead.createdAt).toLocaleDateString()}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
