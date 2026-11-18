import { portalOverviewService } from '@/modules/social/server/portal/portal-overview.service';

function money(value: number, currency: string) {
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

export async function PortalOverviewPanel({
  organizationId,
  customerId,
}: {
  organizationId: string;
  customerId: string;
}) {
  const data = await portalOverviewService.get({ organizationId, customerId });
  const nf = new Intl.NumberFormat();

  return (
    <>
      <div className="mb-6">
        <p className="text-muted-foreground text-sm">Your performance</p>
        <p className="text-muted-foreground mt-1 text-xs">
          A live snapshot of the channels and ads we manage for you.
        </p>
      </div>

      {data.stats.length > 0 ? (
        <div className="mb-10 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {data.stats.map((stat) => (
            <div
              key={stat.label}
              className="border-border bg-surface-muted/40 flex flex-col gap-3 rounded-xl border p-4"
            >
              <div className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                {stat.label}
              </div>
              <p className="text-2xl font-semibold tabular-nums">{stat.value}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="mb-10 rounded-xl border border-border bg-surface p-8 text-center text-muted-foreground">
          {data.hasChannels
            ? 'Your channels are connected. Stats will appear here as soon as the first metrics sync in.'
            : 'Connect a channel to see audience, reach, and recent posts here.'}
        </div>
      )}

      {data.thisMonth.length > 0 ? (
        <section className="mb-10">
          <h3 className="mb-4 text-lg font-semibold text-foreground">What we did this month</h3>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.thisMonth.map((item) => (
              <li
                key={item.id}
                className="rounded-xl border border-border bg-surface px-4 py-3 shadow-sm"
              >
                <p className="text-2xl font-bold text-foreground">{item.value}</p>
                <p className="text-sm text-muted-foreground">{item.label}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {data.goals.length > 0 ? (
        <section className="mb-10">
          <h3 className="mb-4 text-lg font-semibold text-foreground">Goals</h3>
          <ul className="space-y-4">
            {data.goals.map((goal) => {
              const pct = Math.min(100, Math.round((goal.current / goal.target) * 100));
              const currentLabel =
                goal.unit === 'money'
                  ? money(goal.current, goal.currency ?? 'INR')
                  : nf.format(goal.current);
              const targetLabel =
                goal.unit === 'money'
                  ? money(goal.target, goal.currency ?? 'INR')
                  : nf.format(goal.target);
              return (
                <li key={goal.id} className="rounded-xl border border-border bg-surface p-4 shadow-sm">
                  <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium text-foreground">{goal.label}</span>
                    <span className="text-muted-foreground">
                      {currentLabel} / {targetLabel}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-surface-muted">
                    <div
                      className="h-full rounded-full bg-foreground"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  {goal.id === 'budget' ? (
                    <p className="mt-2 text-xs text-muted-foreground">{pct}% of planned budget used</p>
                  ) : (
                    <p className="mt-2 text-xs text-muted-foreground">{pct}% of goal</p>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {data.hasChannels ? (
        <>
          <h3 className="mb-4 text-lg font-semibold text-foreground">Recent posts</h3>
          {data.recentPosts.length === 0 ? (
            <div className="rounded-xl border border-border bg-surface p-12 text-center text-muted-foreground">
              No published posts yet.
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {data.recentPosts.map((post) => {
                const card = (
                  <>
                    {post.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={post.thumbnailUrl}
                        alt=""
                        className="mb-4 aspect-square w-full rounded-lg object-cover"
                      />
                    ) : (
                      <div className="mb-4 aspect-square w-full rounded-lg bg-surface-muted" />
                    )}
                    <div className="mb-2 flex items-center gap-2">
                      {post.channelPicture ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={post.channelPicture} alt="" className="h-5 w-5 rounded-full" />
                      ) : null}
                      <span className="text-xs text-muted-foreground">
                        {post.channelName} · {new Date(post.publishedAt).toLocaleDateString()}
                      </span>
                    </div>
                    {post.caption ? (
                      <p className="mb-3 line-clamp-2 text-sm text-foreground">{post.caption}</p>
                    ) : null}
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      <span>♥ {nf.format(post.likes)}</span>
                      <span>💬 {nf.format(post.comments)}</span>
                      {post.reach != null ? <span>Reach {nf.format(post.reach)}</span> : null}
                    </div>
                  </>
                );
                return post.permalink ? (
                  <a
                    key={post.id}
                    href={post.permalink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-xl border border-border bg-surface p-4 shadow-sm transition hover:shadow-md"
                  >
                    {card}
                  </a>
                ) : (
                  <div key={post.id} className="rounded-xl border border-border bg-surface p-4 shadow-sm">
                    {card}
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : null}
    </>
  );
}
