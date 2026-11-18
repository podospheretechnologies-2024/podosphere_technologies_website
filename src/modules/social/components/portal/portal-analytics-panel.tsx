import { portalAnalyticsService } from '@/modules/social/server/portal/portal-analytics.service';

export async function PortalAnalyticsPanel({
  organizationId,
  customerId,
}: {
  organizationId: string;
  customerId: string;
}) {
  const data = await portalAnalyticsService.get({ organizationId, customerId });
  const nf = new Intl.NumberFormat();

  return (
    <>
      <div className="mb-8">
        <h2 className="text-2xl font-bold">Analytics</h2>
        <p className="mt-1 text-muted-foreground">
          Per-channel growth and best posts ({data.since} → {data.until}).
        </p>
      </div>

      {data.channels.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-12 text-center text-muted-foreground">
          Connect a channel to see analytics here.
        </div>
      ) : (
        <>
          <div className="mb-10 grid gap-4 sm:grid-cols-2">
            {data.channels.map((channel) => (
              <div
                key={`${channel.provider}-${channel.name}`}
                className="rounded-xl border border-border bg-surface p-5 shadow-sm"
              >
                <div className="mb-4 flex items-center gap-3">
                  {channel.picture ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={channel.picture} alt="" className="h-10 w-10 rounded-full" />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-surface-muted" />
                  )}
                  <div>
                    <div className="font-semibold text-foreground">{channel.name}</div>
                    <div className="text-xs text-muted-foreground capitalize">{channel.provider}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-muted-foreground">Followers</div>
                    <div className="font-semibold">
                      {channel.followers != null ? nf.format(channel.followers) : '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Posts (30d)</div>
                    <div className="font-semibold">{nf.format(channel.posts30)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Reach (30d)</div>
                    <div className="font-semibold">{nf.format(channel.reach30)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Impressions (30d)</div>
                    <div className="font-semibold">{nf.format(channel.impressions30)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <h3 className="mb-4 text-lg font-semibold text-foreground">Best posts</h3>
          {data.bestPosts.length === 0 ? (
            <div className="rounded-xl border border-border bg-surface p-8 text-center text-muted-foreground">
              No posts in this period yet.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {data.bestPosts.map((post) => {
                const body = (
                  <>
                    {post.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={post.thumbnailUrl}
                        alt=""
                        className="mb-3 aspect-square w-full rounded-lg object-cover"
                      />
                    ) : (
                      <div className="mb-3 aspect-square w-full rounded-lg bg-surface-muted" />
                    )}
                    <div className="mb-1 text-xs text-muted-foreground">
                      {post.channelName} · {new Date(post.publishedAt).toLocaleDateString()}
                    </div>
                    {post.caption ? (
                      <p className="mb-2 line-clamp-2 text-sm text-foreground">{post.caption}</p>
                    ) : null}
                    <div className="flex gap-3 text-xs text-muted-foreground">
                      <span>♥ {nf.format(post.likes)}</span>
                      <span>💬 {nf.format(post.comments)}</span>
                      {post.engagementRate != null ? (
                        <span>{post.engagementRate.toFixed(1)}%</span>
                      ) : null}
                    </div>
                  </>
                );
                return post.permalink ? (
                  <a
                    key={post.id}
                    href={post.permalink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-xl border border-border bg-surface p-3 shadow-sm hover:shadow-md"
                  >
                    {body}
                  </a>
                ) : (
                  <div key={post.id} className="rounded-xl border border-border bg-surface p-3 shadow-sm">
                    {body}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </>
  );
}
