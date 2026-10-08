import 'dotenv/config';
import { startAutomationWorker } from '@/modules/social/server/automation/automation.worker';
import { startPublishWorker } from '@/modules/social/server/publishing/publish.worker';
import { startAdsWorker } from '@/modules/social/server/ads/ads.worker';
import { startAnalyticsWorker } from '@/modules/social/server/analytics/analytics.worker';
import { startIntegrationWorker } from '@/modules/social/server/integrations/integration.worker';
import { startAlertWorker } from '@/modules/social/server/alerts/alert.worker';

// Background process for queued jobs. Every module that needs background work
// starts its workers here.
async function main() {
  const workers = [
    await startPublishWorker(), 
    await startAutomationWorker(),
    await startAdsWorker(),
    await startAnalyticsWorker(),
    await startIntegrationWorker(),
    await startAlertWorker(),
  ];
  console.log('[worker] started');

  let stopping = false;
  const stop = async () => {
    if (stopping) {
      return;
    }
    stopping = true;
    console.log('[worker] stopping...');
    await Promise.all(workers.map((worker) => worker.close()));
    process.exit(0);
  };

  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

main().catch((error) => {
  console.error('[worker] failed to start', error);
  process.exit(1);
});
