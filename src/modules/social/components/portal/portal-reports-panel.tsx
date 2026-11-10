import { portalReportsService } from '@/modules/social/server/portal/portal-reports.service';

export async function PortalReportsPanel({
  organizationId,
  customerId,
}: {
  organizationId: string;
  customerId: string;
}) {
  const reports = await portalReportsService.list({ organizationId, customerId });

  return (
    <>
      <div className="mb-8">
        <h2 className="text-2xl font-bold">Reports</h2>
        <p className="mt-1 text-gray-500">Monthly PDF reports for your brand.</p>
      </div>

      {reports.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-gray-500">
          No reports yet. Your agency will share monthly PDFs here when they are ready.
        </div>
      ) : (
        <ul className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white">
          {reports.map((report) => (
            <li
              key={report.id}
              className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="font-medium text-gray-900">{report.title}</div>
                <div className="text-sm text-gray-500">
                  {new Date(report.periodStart).toLocaleDateString()} –{' '}
                  {new Date(report.periodEnd).toLocaleDateString()}
                </div>
              </div>
              {report.pdfUrl ? (
                <a
                  href={report.pdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800"
                >
                  Download PDF
                </a>
              ) : (
                <span className="text-sm text-gray-500">PDF preparing…</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
