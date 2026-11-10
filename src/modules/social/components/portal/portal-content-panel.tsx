import Link from 'next/link';
import { PortalApprovalActions } from '@/modules/social/components/approver/portal-approval-actions';
import type { PortalSession } from '@/modules/social/server/approvals/approval.service';
import { portalContentService } from '@/modules/social/server/portal/portal-content.service';

function clientNotesFromSettings(settings: unknown): { at: string; text: string }[] {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return [];
  const notes = (settings as { clientNotes?: unknown }).clientNotes;
  if (!Array.isArray(notes)) return [];
  return notes
    .filter(
      (item): item is { at: string; text: string } =>
        !!item &&
        typeof item === 'object' &&
        typeof (item as { at?: unknown }).at === 'string' &&
        typeof (item as { text?: unknown }).text === 'string'
    )
    .map((item) => ({ at: item.at, text: item.text }));
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y!, (m! - 1) + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export async function PortalContentPanel({
  session,
  month,
}: {
  session: PortalSession;
  month?: string;
}) {
  const data = await portalContentService.get(session, month);
  const prev = shiftMonth(data.month, -1);
  const next = shiftMonth(data.month, 1);
  const monthLabel = new Date(`${data.month}-01T00:00:00`).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  const byDay = new Map<string, typeof data.calendar>();
  for (const item of data.calendar) {
    const day = item.date.slice(0, 10);
    const list = byDay.get(day) ?? [];
    list.push(item);
    byDay.set(day, list);
  }
  const days = [...byDay.keys()].sort();

  return (
    <>
      <div className="mb-8">
        <h2 className="text-2xl font-bold">Content</h2>
        <p className="mt-1 text-gray-500">
          Approve drafts, leave notes, and see what is planned or already live.
        </p>
      </div>

      <section className="mb-10">
        <h3 className="mb-3 text-lg font-semibold text-gray-900">Waiting for your approval</h3>
        {data.approvalQueue.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-gray-500">
            Nothing waiting right now.
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {data.approvalQueue.map((draft) => (
              <div key={draft.id} className="flex flex-col rounded-xl border border-gray-200 bg-white p-6">
                <div className="mb-4 flex items-center gap-3">
                  {draft.integration.picture ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={draft.integration.picture} alt="" className="h-8 w-8 rounded-full" />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-gray-100" />
                  )}
                  <div>
                    <div className="text-sm font-medium">{draft.integration.name}</div>
                    <div className="text-xs text-gray-500">
                      Scheduled for {draft.publishDate.toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <p className="mb-6 flex-grow text-sm whitespace-pre-wrap text-gray-700">{draft.content}</p>
                <PortalApprovalActions
                  group={draft.group}
                  initialNotes={clientNotesFromSettings(draft.settings)}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-gray-900">Calendar · {monthLabel}</h3>
          <div className="flex gap-2 text-sm">
            <Link
              href={`/portal/content?month=${prev}`}
              className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 hover:bg-gray-50"
            >
              Previous
            </Link>
            <Link
              href={`/portal/content?month=${next}`}
              className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 hover:bg-gray-50"
            >
              Next
            </Link>
          </div>
        </div>

        {days.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-gray-500">
            No planned or published posts in this month.
          </div>
        ) : (
          <div className="space-y-4">
            {days.map((day) => (
              <div key={day} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="mb-3 text-sm font-semibold text-gray-900">
                  {new Date(`${day}T00:00:00`).toLocaleDateString(undefined, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })}
                </div>
                <ul className="space-y-3">
                  {(byDay.get(day) ?? []).map((item) => (
                    <li
                      key={`${item.kind}-${item.id}`}
                      className="flex flex-col gap-2 border-t border-gray-50 pt-3 first:border-0 first:pt-0 sm:flex-row sm:items-start sm:justify-between"
                    >
                      <div className="min-w-0">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              item.kind === 'published'
                                ? 'bg-green-100 text-green-800'
                                : item.kind === 'approval'
                                  ? 'bg-amber-100 text-amber-900'
                                  : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {item.stateLabel}
                          </span>
                          <span className="text-xs text-gray-500">{item.channelName}</span>
                        </div>
                        <p className="text-sm text-gray-800">{item.title}</p>
                      </div>
                      <div className="shrink-0">
                        {item.kind === 'approval' && item.group ? (
                          <PortalApprovalActions group={item.group} />
                        ) : item.permalink ? (
                          <a
                            href={item.permalink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-gray-900 underline underline-offset-2"
                          >
                            View
                          </a>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
