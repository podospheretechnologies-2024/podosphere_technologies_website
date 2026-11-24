import 'dotenv/config';
import { startAutomationWorker } from '@/modules/social/server/automation/automation.worker';
import { startPublishWorker } from '@/modules/social/server/publishing/publish.worker';
import { startAdsWorker } from '@/modules/social/server/ads/ads.worker';
import { startAnalyticsWorker } from '@/modules/social/server/analytics/analytics.worker';
import { startIntegrationWorker } from '@/modules/social/server/integrations/integration.worker';
import { startAlertWorker } from '@/modules/social/server/alerts/alert.worker';
import { startReportWorker } from '@/modules/social/server/reports/report.worker';
import { startWeeklyPlanWorker } from '@/modules/social/server/ai/weekly-plan.worker';
import { startGrowthWorker } from '@/modules/social/server/growth/growth.worker';
import { startOrderFlowWorker } from '@/modules/social/server/whatsapp/order-flow.worker';
import { startGoogleSheetsWorker } from '@/modules/social/server/google-sheets/google-sheets.worker';
import { startPodoCrmPingWorker } from '@/modules/social/server/podocrm/podocrm-ping.worker';

// Background process for queued jobs. Every module that needs background work
// starts its workers here.
async function main() {
  const workers = [
    await startPublishWorker(), 
    await startAutomationWorker(),
    await startAdsWorker(),
    await startAnalyticsWorker(),
    await startIntegrationWorker(),
    await startAlertWorker(), // alerts.evaluate + alerts.slaSweep
    await startReportWorker(),
    await startWeeklyPlanWorker(),
    await startGrowthWorker(), // Growth Desk: Shopify sync, post tasks, daily insights
    await startOrderFlowWorker(), // WhatsApp order flows: due messages every 5 min
    await startGoogleSheetsWorker(), // Google Sheets sync every 15 min
    await startPodoCrmPingWorker(), // PodoCRM link keep-alive ping, daily
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
