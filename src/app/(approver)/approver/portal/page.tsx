import { headers } from 'next/headers';
import { PortalApprovalActions } from '@/modules/social/components/approver/portal-approval-actions';
import { ConnectChannelButton } from '@/modules/social/components/channels/connect-channel-button';
import { BrandedPortalShell } from '@/modules/social/components/shell/branded-portal-shell';
import { approvalService } from '@/modules/social/server/approvals/approval.service';
import { prisma } from '@/shared/lib/prisma';
import { brandingFromOrg, resolveOrgBranding } from '@/shared/server/org-branding';
import { getPortalSessionOrNull } from '@/shared/server/portal-session';

export const metadata = { title: 'Approvals Portal | Podo Social' };

export default async function ApproverPortalPage(props: { searchParams: Promise<{ tab?: string; connected?: string }> }) {
  const searchParams = await props.searchParams;
  const tab = searchParams.tab || 'posts';

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

  // Magic-link portal only shows this client's queue at the CLIENT step.
  const drafts = await approvalService.listPortalQueue(session);

  const integrations = await prisma.socialIntegration.findMany({
    where: { customerId: session.customerId, deletedAt: null },
  });
  const integrationIds = integrations.map((i) => i.id);

  const followers = await prisma.socialInsightDaily.findMany({
    where: { integrationId: { in: integrationIds }, metric: 'followers' },
    orderBy: { date: 'desc' },
    distinct: ['integrationId'],
  });
  const totalFollowers = followers.reduce((acc, curr) => acc + Number(curr.value), 0);

  return (
    <BrandedPortalShell branding={branding}>
      {totalFollowers > 0 && (
        <div className="mb-10 flex items-center justify-between rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div>
            <h2 className="mb-1 text-sm font-semibold tracking-wider text-gray-500 uppercase">
              Total Audience Size
            </h2>
            <div className="text-4xl font-bold text-gray-900">{totalFollowers.toLocaleString()}</div>
          </div>
          <div className="text-right">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800">
              Live Data Active
            </span>
          </div>
        </div>
      )}

      <div className="mb-8 flex items-center gap-6 border-b border-gray-200">
        <a
          href="/approver/portal?tab=posts"
          className={`border-b-2 pb-3 text-sm font-medium transition-colors ${
            tab === 'posts' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Posts for Approval
        </a>
        <a
          href="/approver/portal?tab=channels"
          className={`border-b-2 pb-3 text-sm font-medium transition-colors ${
            tab === 'channels' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          My Channels
        </a>
      </div>

      {searchParams.connected && (
        <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4 text-sm font-medium text-green-800">
          Successfully connected: {searchParams.connected}
        </div>
      )}

      {tab === 'posts' ? (
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
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Connected Channels</h2>
              <p className="mt-1 text-gray-500">Manage the social media accounts connected to your portal.</p>
            </div>
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
          </div>

          {integrations.length === 0 ? (
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
