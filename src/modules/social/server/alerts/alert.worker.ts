import 'server-only';
import { Worker, type Job } from 'bullmq';
import { createQueueConnection } from '@/shared/lib/queue';
import { getAlertQueue, closeAlertQueue, ALERT_JOB, ALERT_QUEUE_NAME } from './alert.queue';
import { alertService } from './alert.service';
import { agencyWhatsAppService } from '../whatsapp/agency-whatsapp.service';
import { leadWhatsAppService } from '../whatsapp/lead-whatsapp.service';

const EVALUATE_ALERTS_EVERY_MS = 60 * 60 * 1000; // Hourly
const SLA_SWEEP_EVERY_MS = 5 * 60 * 1000; // Every 5 minutes
const LEAD_FOLLOW_UPS_EVERY_MS = 10 * 60 * 1000; // WhatsApp follow-ups to leads
const AGENCY_REMINDERS_EVERY_MS = 60 * 60 * 1000; // Approval + payment WhatsApp

function processJob(job: Job) {
  switch (job.name) {
    case ALERT_JOB.evaluateRules:
      return alertService.runAllAlerts();
    case ALERT_JOB.slaSweep:
      return alertService.evaluateSlaBreaches();
    case ALERT_JOB.leadFollowUps:
      return leadWhatsAppService.runFollowUps();
    case ALERT_JOB.agencyApprovalReminders:
      return agencyWhatsAppService.runApprovalReminders();
    case ALERT_JOB.agencyPaymentReminders:
      return agencyWhatsAppService.runPaymentReminders();
    default:
      throw new Error(`Unknown job "${job.name}"`);
  }
}

export async function startAlertWorker(): Promise<{ close(): Promise<void> }> {
  const queue = getAlertQueue();
  
  await queue.upsertJobScheduler(
    ALERT_JOB.evaluateRules,
    { every: EVALUATE_ALERTS_EVERY_MS },
    { name: ALERT_JOB.evaluateRules }
  );
  await queue.upsertJobScheduler(
    ALERT_JOB.slaSweep,
    { every: SLA_SWEEP_EVERY_MS },
    { name: ALERT_JOB.slaSweep }
  );
  await queue.upsertJobScheduler(
    ALERT_JOB.leadFollowUps,
    { every: LEAD_FOLLOW_UPS_EVERY_MS },
    { name: ALERT_JOB.leadFollowUps }
  );
  await queue.upsertJobScheduler(
    ALERT_JOB.agencyApprovalReminders,
    { every: AGENCY_REMINDERS_EVERY_MS },
    { name: ALERT_JOB.agencyApprovalReminders }
  );
  await queue.upsertJobScheduler(
    ALERT_JOB.agencyPaymentReminders,
    { every: AGENCY_REMINDERS_EVERY_MS },
    { name: ALERT_JOB.agencyPaymentReminders }
  );
  const worker = new Worker(ALERT_QUEUE_NAME, processJob, {
    connection: createQueueConnection(),
    concurrency: 2,
  });

  worker.on('failed', (job, error) => {
    console.error(`[alert-worker] ${job?.name} failed: ${error.message}`);
  });

  return {
    async close() {
      await worker.close();
      await closeAlertQueue();
    },
  };
}
