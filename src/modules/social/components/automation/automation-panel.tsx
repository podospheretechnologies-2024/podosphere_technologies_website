'use client';

import { useAiStatus } from '../../hooks/use-ai-status';
import { useChannels } from '../../hooks/use-channels';
import { AutopostsCard } from './autoposts-card';
import { GoogleSheetsCard } from './google-sheets-card';
import { WebhooksCard } from './webhooks-card';

export function AutomationPanel() {
  const { data: channelsData, error } = useChannels();
  const { data: aiStatus } = useAiStatus();

  if (error && !channelsData) {
    return (
      <div
        role="alert"
        className="border-danger/40 bg-danger/10 text-danger rounded-lg border p-4 text-sm"
      >
        {error instanceof Error ? error.message : 'Could not load channels'}
      </div>
    );
  }
  if (!channelsData) {
    return <p className="text-muted-foreground text-sm">Loading…</p>;
  }

  return (
    <div className="grid items-start gap-6 xl:grid-cols-2">
      <AutopostsCard
        channels={channelsData.channels}
        aiConfigured={aiStatus?.configured ?? false}
      />
      <WebhooksCard channels={channelsData.channels} />
      <GoogleSheetsCard />
    </div>
  );
}
