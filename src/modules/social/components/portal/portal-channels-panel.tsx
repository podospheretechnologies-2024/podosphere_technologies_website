import { ConnectChannelButton } from '@/modules/social/components/channels/connect-channel-button';
import { prisma } from '@/shared/lib/prisma';

export async function PortalChannelsPanel({
  organizationId,
  customerId,
  connected,
}: {
  organizationId: string;
  customerId: string;
  connected?: string;
}) {
  const integrations = await prisma.socialIntegration.findMany({
    where: { organizationId, customerId, deletedAt: null },
  });
  const hasChannels = integrations.length > 0;

  return (
    <>
      {connected ? (
        <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4 text-sm font-medium text-green-800">
          Successfully connected: {connected}
        </div>
      ) : null}

      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Connected Channels</h2>
          <p className="mt-1 text-gray-500">
            {hasChannels
              ? 'These social accounts are connected to your portal.'
              : 'Connect a social account to get started.'}
          </p>
        </div>
        {!hasChannels ? (
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
        ) : null}
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
                  <div className="text-sm text-gray-500 capitalize">
                    {integration.providerIdentifier}
                  </div>
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
  );
}
