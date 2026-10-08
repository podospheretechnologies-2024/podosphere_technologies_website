import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { approvalService } from '@/modules/social/server/approvals/approval.service';
import { ConnectChannelButton } from '@/modules/social/components/channels/connect-channel-button';
import { prisma } from '@/shared/lib/prisma';

export const metadata = { title: 'Approvals Portal | Podo Social' };

export default async function ApproverPortalPage(props: { searchParams: Promise<{ tab?: string, connected?: string }> }) {
  const searchParams = await props.searchParams;
  const tab = searchParams.tab || 'posts';

  const cookieStore = await cookies();
  const token = cookieStore.get('approver_session')?.value;

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white p-8 rounded-xl shadow-sm text-center border border-gray-200">
          <h1 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-500">Your session has expired. Please use the magic link from your email.</p>
        </div>
      </div>
    );
  }

  let session;
  try {
    session = await approvalService.verifyToken(token);
  } catch (err) {
    redirect('/api/approver/logout');
  }

  const organization = await prisma.organization.findUnique({
    where: { id: session.organizationId }
  });

  const drafts = await prisma.socialPost.findMany({
    where: {
      organizationId: session.organizationId,
      integration: { customerId: session.customerId },
      state: 'DRAFT',
      deletedAt: null,
      parentPostId: null,
    },
    include: { integration: true },
    orderBy: { publishDate: 'asc' },
  });

  const integrations = await prisma.socialIntegration.findMany({
    where: { customerId: session.customerId, deletedAt: null }
  });
  const integrationIds = integrations.map(i => i.id);
  
  const followers = await prisma.socialInsightDaily.findMany({
    where: { integrationId: { in: integrationIds }, metric: 'followers' },
    orderBy: { date: 'desc' },
    distinct: ['integrationId']
  });
  const totalFollowers = followers.reduce((acc, curr) => acc + Number(curr.value), 0);

  const themeColor = organization?.themeColor || '#111827';
  
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="border-b border-gray-200 sticky top-0 z-10" style={{ backgroundColor: themeColor }}>
        <div className="max-w-5xl mx-auto px-6 py-4 flex justify-between items-center text-white">
          <div className="flex items-center gap-3">
            {organization?.logoUrl && (
              <img src={organization.logoUrl} alt="Logo" className="h-8 rounded" />
            )}
            <h1 className="font-bold text-lg tracking-tight">{organization?.name || 'Client Portal'}</h1>
          </div>
          <button className="text-sm opacity-80 hover:opacity-100 transition">Log out</button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {totalFollowers > 0 && (
          <div className="mb-10 bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1">Total Audience Size</h2>
              <div className="text-4xl font-bold text-gray-900">{totalFollowers.toLocaleString()}</div>
            </div>
            <div className="text-right">
              <span className="inline-flex items-center gap-1.5 py-1 px-3 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Live Data Active
              </span>
            </div>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex items-center gap-6 border-b border-gray-200 mb-8">
          <a
            href="/approver/portal?tab=posts"
            className={`pb-3 font-medium text-sm transition-colors border-b-2 ${
              tab === 'posts' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Posts for Approval
          </a>
          <a
            href="/approver/portal?tab=channels"
            className={`pb-3 font-medium text-sm transition-colors border-b-2 ${
              tab === 'channels' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            My Channels
          </a>
        </div>

        {searchParams.connected && (
          <div className="mb-6 p-4 bg-green-50 text-green-800 border border-green-200 rounded-lg text-sm font-medium">
            Successfully connected: {searchParams.connected}
          </div>
        )}

        {tab === 'posts' ? (
          <>
            <div className="mb-8">
              <h2 className="text-2xl font-bold">Posts waiting for your approval</h2>
              <p className="text-gray-500 mt-1">Review your upcoming social media content.</p>
            </div>

            {drafts.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                <h3 className="text-lg font-medium text-gray-900 mb-1">All caught up!</h3>
                <p className="text-gray-500">There are no posts currently waiting for your approval.</p>
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2">
                {drafts.map((draft) => (
                  <div key={draft.id} className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col">
                    <div className="flex items-center gap-3 mb-4">
                      {draft.integration.picture ? (
                        <img src={draft.integration.picture} alt="" className="w-8 h-8 rounded-full" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gray-100" />
                      )}
                      <div>
                        <div className="text-sm font-medium">{draft.integration.name}</div>
                        <div className="text-xs text-gray-500">
                          Scheduled for {draft.publishDate.toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    
                    <p className="text-sm text-gray-700 whitespace-pre-wrap mb-6 flex-grow">
                      {draft.content}
                    </p>

                    <div className="flex gap-3 pt-4 border-t border-gray-100 mt-auto">
                      <button className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition">
                        Request Edit
                      </button>
                      <button className="flex-1 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition">
                        Approve
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-bold">Connected Channels</h2>
                <p className="text-gray-500 mt-1">Manage the social media accounts connected to your portal.</p>
              </div>
              <div className="flex gap-2">
                <ConnectChannelButton
                  provider="facebook"
                  label="Connect Facebook"
                  className="bg-black text-white hover:bg-gray-800 transition rounded-lg px-4 py-2 text-sm font-medium"
                />
                <ConnectChannelButton
                  provider="instagram"
                  label="Connect Instagram"
                  className="bg-black text-white hover:bg-gray-800 transition rounded-lg px-4 py-2 text-sm font-medium"
                />
              </div>
            </div>

            {integrations.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                <h3 className="text-lg font-medium text-gray-900 mb-1">No channels connected</h3>
                <p className="text-gray-500 mb-4">You have not connected any social media accounts yet.</p>
                <ConnectChannelButton
                  provider="facebook"
                  label="Connect Account"
                  className="inline-flex bg-black text-white hover:bg-gray-800 transition rounded-lg px-4 py-2 text-sm font-medium"
                />
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2">
                {integrations.map((integration) => (
                  <div key={integration.id} className="bg-white rounded-xl border border-gray-200 p-6 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {integration.picture ? (
                        <img src={integration.picture} alt="" className="w-12 h-12 rounded-full border border-gray-100" />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-gray-100" />
                      )}
                      <div>
                        <div className="font-semibold text-gray-900">{integration.name}</div>
                        <div className="text-sm text-gray-500 capitalize">{integration.providerIdentifier}</div>
                      </div>
                    </div>
                    <div>
                      <span className="inline-flex items-center gap-1.5 py-1 px-3 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Connected
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
