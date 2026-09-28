import 'dotenv/config';
import { startPublishWorker } from '@/modules/social/server/publishing/publish.worker';

// Background process for queued jobs. Every module that needs background work
// starts its workers here.
async function main() {
  const workers = [await startPublishWorker()];
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
