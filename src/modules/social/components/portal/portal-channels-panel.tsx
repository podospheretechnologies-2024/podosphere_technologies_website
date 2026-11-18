import { ConnectChannelButton } from '@/modules/social/components/channels/connect-channel-button';
import { prisma } from '@/shared/lib/prisma';

export async function PortalChannelsPanel({
  organizationId,
  customerId,
  connected,
  canAct = true,
}: {
  organizationId: string;
  customerId: string;
  connected?: string;
  /** False when the agency set this tab to "View only": no connect buttons. */
  canAct?: boolean;
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
          <h2 className="text-2xl font-bold">Integrations</h2>
          <p className="mt-1 text-muted-foreground">
            {hasChannels
              ? 'These social accounts are connected to your portal.'
              : canAct
                ? 'Connect a social account to get started.'
                : 'Your agency connects your social accounts.'}
          </p>
        </div>
        {!hasChannels && canAct ? (
          <div className="flex gap-2">
            <ConnectChannelButton
              provider="facebook"
              label="Connect Facebook"
              className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90"
            />
            <ConnectChannelButton
              provider="instagram"
              label="Connect Instagram"
              className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90"
            />
          </div>
        ) : null}
      </div>

      {!hasChannels ? (
        <div className="rounded-xl border border-border bg-surface p-12 text-center">
          <h3 className="mb-1 text-lg font-medium text-foreground">No channels connected</h3>
          <p className="mb-4 text-muted-foreground">No social media accounts are connected yet.</p>
          {canAct ? (
            <ConnectChannelButton
              provider="facebook"
              label="Connect Account"
              className="inline-flex rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90"
            />
          ) : null}
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {integrations.map((integration) => (
            <div
              key={integration.id}
              className="flex items-center justify-between rounded-xl border border-border bg-surface p-6"
            >
              <div className="flex items-center gap-4">
                {integration.picture ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={integration.picture}
                    alt=""
                    className="h-12 w-12 rounded-full border border-border"
                  />
                ) : (
                  <div className="h-12 w-12 rounded-full bg-surface-muted" />
                )}
                <div>
                  <div className="font-semibold text-foreground">{integration.name}</div>
                  <div className="text-sm text-muted-foreground capitalize">
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
