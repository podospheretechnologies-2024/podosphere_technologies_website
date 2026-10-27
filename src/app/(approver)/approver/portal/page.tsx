import { headers } from 'next/headers';
import { PortalApprovalActions } from '@/modules/social/components/approver/portal-approval-actions';
import { ConnectChannelButton } from '@/modules/social/components/channels/connect-channel-button';
import { BrandedPortalShell } from '@/modules/social/components/shell/branded-portal-shell';
import { approvalService } from '@/modules/social/server/approvals/approval.service';
import { prisma } from '@/shared/lib/prisma';
import { brandingFromOrg, resolveOrgBranding } from '@/shared/server/org-branding';
import { getPortalSessionOrNull } from '@/shared/server/portal-session';

export const metadata = { title: 'Client Portal | Podo Social' };

type Tab = 'overview' | 'posts' | 'channels';

export default async function ApproverPortalPage(props: {
  searchParams: Promise<{ tab?: string; connected?: string }>;
}) {
  const searchParams = await props.searchParams;

  const session = await getPortalSessionOrNull();
  const headerStore = await headers();
  const hostSlug = headerStore.get('x-podo-org-slug');
  const customDomain = headerStore.get('x-podo-custom-domain');

  if (!session) {
    const hostBranding = await resolveOrgBranding({ slug: hostSlug, customDomain });
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          {hostBranding?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={hostBranding.logoUrl} alt="" className="mx-auto mb-4 h-10" />
          ) : null}
          <h1 className="mb-2 text-xl font-bold text-gray-900">
            {hostBranding?.portalTitle ?? 'Access Denied'}
          </h1>
          <p className="text-gray-500">Your session has expired. Please use the magic link from your email.</p>
        </div>
      </div>
    );
  }

  const organization = await prisma.organization.findUnique({
    where: { id: session.organizationId },
    select: { name: true, slug: true, logoUrl: true, primaryColor: true, portalTitle: true },
  });
  const branding = organization
    ? brandingFromOrg(organization)
    : brandingFromOrg({ name: 'Client Portal', slug: 'portal' });

  const integrations = await prisma.socialIntegration.findMany({
    where: { customerId: session.customerId, deletedAt: null },
  });
  const integrationIds = integrations.map((i) => i.id);
  const hasChannels = integrations.length > 0;
  const integrationById = new Map(integrations.map((i) => [i.id, i]));

  // Channels are already connected → the client just wants to see their data, so the dashboard
  // (not the approval queue or a connect prompt) is the default landing tab.
  const tab: Tab = ((): Tab => {
    const t = searchParams.tab;
    if (t === 'overview' || t === 'posts' || t === 'channels') return t;
    return hasChannels ? 'overview' : 'posts';
  })();

  // Magic-link portal only shows this client's queue at the CLIENT step.
  const drafts = await approvalService.listPortalQueue(session);

  // --- Audience / reach / recent posts (only meaningful once channels exist) ---
  type ExternalPost = Awaited<ReturnType<typeof prisma.socialExternalPost.findMany>>[number];

  let totalFollowers = 0;
  let reach30 = 0;
  let impressions30 = 0;
  let avgEngagement: number | null = null;
  let recentPosts: ExternalPost[] = [];

  if (hasChannels) {
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const [followers, insights, posts] = await Promise.all([
      prisma.socialInsightDaily.findMany({
        where: { integrationId: { in: integrationIds }, metric: 'followers' },
        orderBy: { date: 'desc' },
        distinct: ['integrationId'],
      }),
      prisma.socialInsightDaily.findMany({
        where: {
          integrationId: { in: integrationIds },
          date: { gte: since },
          metric: { in: ['reach', 'impressions'] },
        },
        select: { metric: true, value: true },
      }),
      prisma.socialExternalPost.findMany({
        where: { integrationId: { in: integrationIds } },
        orderBy: { publishedAt: 'desc' },
        take: 6,
      }),
    ]);

    recentPosts = posts;
    totalFollowers = followers.reduce((acc, curr) => acc + Number(curr.value), 0);
    reach30 = insights
      .filter((i) => i.metric === 'reach')
      .reduce((acc, curr) => acc + Number(curr.value), 0);
    impressions30 = insights
      .filter((i) => i.metric === 'impressions')
      .reduce((acc, curr) => acc + Number(curr.value), 0);
    const withEngagement = posts.filter((p) => p.engagementRate != null);
    avgEngagement = withEngagement.length
      ? withEngagement.reduce((acc, p) => acc + Number(p.engagementRate), 0) / withEngagement.length
      : null;
  }

  const nf = new Intl.NumberFormat();

  const tabs: { key: Tab; label: string }[] = [
    ...(hasChannels ? [{ key: 'overview' as Tab, label: 'Overview' }] : []),
    { key: 'posts', label: 'Posts for Approval' },
    { key: 'channels', label: 'My Channels' },
  ];

  const stats: { label: string; value: string }[] = [];
  if (totalFollowers > 0) stats.push({ label: 'Total Audience', value: nf.format(totalFollowers) });
  if (reach30 > 0) stats.push({ label: 'Reach (30 days)', value: nf.format(reach30) });
  if (impressions30 > 0) stats.push({ label: 'Impressions (30 days)', value: nf.format(impressions30) });
  if (avgEngagement != null) stats.push({ label: 'Avg. engagement', value: `${(avgEngagement).toFixed(1)}%` });

  return (
    <BrandedPortalShell branding={branding}>
      <div className="mb-8 flex flex-wrap items-center gap-6 border-b border-gray-200">
        {tabs.map((t) => (
          <a
            key={t.key}
            href={`/approver/portal?tab=${t.key}`}
            className={`border-b-2 pb-3 text-sm font-medium transition-colors ${
              tab === t.key
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
            {t.key === 'posts' && drafts.length > 0 ? (
              <span className="ml-1.5 rounded-full bg-gray-900 px-1.5 py-0.5 text-xs text-white">
                {drafts.length}
              </span>
            ) : null}
          </a>
        ))}
      </div>

      {searchParams.connected && (
        <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4 text-sm font-medium text-green-800">
          Successfully connected: {searchParams.connected}
        </div>
      )}

      {tab === 'overview' ? (
        <>
          <div className="mb-8">
            <h2 className="text-2xl font-bold">Your social performance</h2>
            <p className="mt-1 text-gray-500">A live snapshot of the channels we manage for you.</p>
          </div>

          {stats.length > 0 ? (
            <div className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {stats.map((stat) => (
                <div key={stat.label} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                  <div className="mb-1 text-sm font-medium text-gray-500">{stat.label}</div>
                  <div className="text-3xl font-bold text-gray-900">{stat.value}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mb-10 rounded-xl border border-gray-200 bg-white p-8 text-center text-gray-500">
              Your channels are connected. Performance data will appear here as soon as the first
              metrics sync in.
            </div>
          )}

          <h3 className="mb-4 text-lg font-semibold text-gray-900">Recent posts</h3>
          {recentPosts.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-gray-500">
              No published posts yet.
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {recentPosts.map((post) => {
                const channel = integrationById.get(post.integrationId);
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
                      <div className="mb-4 aspect-square w-full rounded-lg bg-gray-100" />
                    )}
                    <div className="mb-2 flex items-center gap-2">
                      {channel?.picture ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={channel.picture} alt="" className="h-5 w-5 rounded-full" />
                      ) : null}
                      <span className="text-xs text-gray-500">
                        {channel?.name ?? 'Channel'} · {post.publishedAt.toLocaleDateString()}
                      </span>
                    </div>
                    {post.caption ? (
                      <p className="mb-3 line-clamp-2 text-sm text-gray-700">{post.caption}</p>
                    ) : null}
                    <div className="flex gap-4 text-xs text-gray-500">
                      <span>♥ {nf.format(post.likes ?? 0)}</span>
                      <span>💬 {nf.format(post.comments ?? 0)}</span>
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
                    className="block rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:shadow-md"
                  >
                    {card}
                  </a>
                ) : (
                  <div key={post.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                    {card}
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : tab === 'posts' ? (
        <>
          <div className="mb-8">
            <h2 className="text-2xl font-bold">Posts waiting for your approval</h2>
            <p className="mt-1 text-gray-500">Review your upcoming social media content.</p>
          </div>

          {drafts.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
              <h3 className="mb-1 text-lg font-medium text-gray-900">All caught up!</h3>
              <p className="text-gray-500">There are no posts currently waiting for your approval.</p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {drafts.map((draft) => (
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

                  <PortalApprovalActions group={draft.group} />
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold">Connected Channels</h2>
              <p className="mt-1 text-gray-500">
                {hasChannels
                  ? 'These social accounts are connected to your portal.'
                  : 'Connect a social account to get started.'}
              </p>
            </div>
            {!hasChannels && (
              <div className="flex gap-2">
                <ConnectChannelButton
                  provider="facebook"
                  label="Connect Facebook"
                  className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800"
                />
                <ConnectChannelButton
                  provider="instagram"
                  label="Connect Instagram"
                  className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800"
                />
              </div>
            )}
          </div>

          {!hasChannels ? (
            <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
              <h3 className="mb-1 text-lg font-medium text-gray-900">No channels connected</h3>
              <p className="mb-4 text-gray-500">You have not connected any social media accounts yet.</p>
              <ConnectChannelButton
                provider="facebook"
                label="Connect Account"
                className="inline-flex rounded-lg bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800"
              />
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {integrations.map((integration) => (
                <div
                  key={integration.id}
                  className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-6"
                >
                  <div className="flex items-center gap-4">
                    {integration.picture ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={integration.picture}
                        alt=""
                        className="h-12 w-12 rounded-full border border-gray-100"
                      />
                    ) : (
                      <div className="h-12 w-12 rounded-full bg-gray-100" />
                    )}
                    <div>
                      <div className="font-semibold text-gray-900">{integration.name}</div>
                      <div className="text-sm text-gray-500 capitalize">{integration.providerIdentifier}</div>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800">
                    Connected
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </BrandedPortalShell>
  );
}
