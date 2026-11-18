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
        <p className="mt-1 text-muted-foreground">Monthly PDF reports for your brand.</p>
      </div>

      {reports.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-12 text-center text-muted-foreground">
          No reports yet. Your agency will share monthly PDFs here when they are ready.
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
          {reports.map((report) => (
            <li
              key={report.id}
              className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="font-medium text-foreground">{report.title}</div>
                <div className="text-sm text-muted-foreground">
                  {new Date(report.periodStart).toLocaleDateString()} –{' '}
                  {new Date(report.periodEnd).toLocaleDateString()}
                </div>
              </div>
              {report.pdfUrl ? (
                <a
                  href={report.pdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-background hover:opacity-90"
                >
                  Download PDF
                </a>
              ) : (
                <span className="text-sm text-muted-foreground">PDF preparing…</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
