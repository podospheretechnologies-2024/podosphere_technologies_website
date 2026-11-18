import Link from 'next/link';
import { PortalApprovalActions } from '@/modules/social/components/approver/portal-approval-actions';
import { PortalRequestPostForm } from '@/modules/social/components/portal/portal-request-post-form';
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
  canAct = true,
}: {
  session: PortalSession;
  month?: string;
  /** False when the agency set this tab to "View only": no approve / note buttons. */
  canAct?: boolean;
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
        <h2 className="text-2xl font-bold">Calendar</h2>
        <p className="mt-1 text-muted-foreground">
          {canAct
            ? 'Approve drafts, leave notes, request a post, and see what is planned or already live.'
            : 'See what is planned, waiting for approval, or already live.'}
        </p>
      </div>

      {canAct ? <PortalRequestPostForm /> : null}

      <section className="mb-10">
        <h3 className="mb-3 text-lg font-semibold text-foreground">Waiting for your approval</h3>
        {data.approvalQueue.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface p-8 text-center text-muted-foreground">
            Nothing waiting right now.
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {data.approvalQueue.map((draft) => (
              <div key={draft.id} className="flex flex-col rounded-xl border border-border bg-surface p-6">
                <div className="mb-4 flex items-center gap-3">
                  {draft.integration.picture ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={draft.integration.picture} alt="" className="h-8 w-8 rounded-full" />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-surface-muted" />
                  )}
                  <div>
                    <div className="text-sm font-medium">{draft.integration.name}</div>
                    <div className="text-xs text-muted-foreground">
                      Scheduled for {draft.publishDate.toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <p className="mb-6 flex-grow text-sm whitespace-pre-wrap text-foreground">{draft.content}</p>
                {canAct ? (
                  <PortalApprovalActions
                    group={draft.group}
                    initialNotes={clientNotesFromSettings(draft.settings)}
                  />
                ) : (
                  <p className="text-xs text-muted-foreground">Waiting for approval</p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <h3 className="text-lg font-semibold text-foreground">Calendar · {monthLabel}</h3>
          <div className="flex w-full gap-2 text-sm sm:w-auto">
            <Link
              href={`/portal/content?month=${prev}`}
              className="inline-flex min-h-10 flex-1 items-center justify-center rounded-lg border border-border bg-surface px-3 py-1.5 hover:bg-surface-muted sm:flex-none"
            >
              Previous
            </Link>
            <Link
              href={`/portal/content?month=${next}`}
              className="inline-flex min-h-10 flex-1 items-center justify-center rounded-lg border border-border bg-surface px-3 py-1.5 hover:bg-surface-muted sm:flex-none"
            >
              Next
            </Link>
          </div>
        </div>

        {days.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface p-8 text-center text-muted-foreground">
            No planned or published posts in this month.
          </div>
        ) : (
          <div className="space-y-4">
            {days.map((day) => (
              <div key={day} className="rounded-xl border border-border bg-surface p-4 shadow-sm">
                <div className="mb-3 text-sm font-semibold text-foreground">
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
                      className="flex flex-col gap-2 border-t border-border pt-3 first:border-0 first:pt-0 sm:flex-row sm:items-start sm:justify-between"
                    >
                      <div className="min-w-0">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              item.kind === 'published'
                                ? 'bg-green-100 text-green-800'
                                : item.kind === 'approval'
                                  ? 'bg-amber-100 text-amber-900'
                                  : 'bg-surface-muted text-foreground'
                            }`}
                          >
                            {item.stateLabel}
                          </span>
                          <span className="text-xs text-muted-foreground">{item.channelName}</span>
                        </div>
                        <p className="text-sm text-foreground">{item.title}</p>
                      </div>
                      <div className="shrink-0">
                        {item.kind === 'approval' && item.group ? (
                          canAct ? (
                            <PortalApprovalActions group={item.group} />
                          ) : (
                            <span className="text-xs text-muted-foreground">Waiting for approval</span>
                          )
                        ) : item.permalink ? (
                          <a
                            href={item.permalink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-foreground underline underline-offset-2"
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
